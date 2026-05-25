# Manual Setup — What setup.sh Does By Hand

This guide walks through every step that `setup.sh` does automatically, but run manually one command at a time. Great for understanding what's actually happening on the VM.

> **You don't need this if you already ran setup.sh.** This is purely for learning — so you understand what each piece is and how to do it yourself.

---

## The Goal

By the end you will have:
1. Docker installed and running
2. Judge0 running inside Docker (code execution sandbox)
3. FastAPI running as a background process
4. nginx sitting in front of FastAPI, accepting web traffic

---

## Step 1 — Install system packages

```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates curl gnupg lsb-release \
  python3-pip python3-venv \
  nginx unzip git nano openssl
```

This updates the package list and installs the tools we need. Nothing starts yet — just installing software.

---

## Step 2 — Install Docker

Ubuntu 24.04 doesn't ship the modern version of Docker. We add Docker's official package source first.

**Add Docker's GPG key** (so apt can verify Docker's packages are legitimate):
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

**Add Docker's apt repository:**
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**Install Docker:**
```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**Add yourself to the docker group** (so you can run docker without sudo):
```bash
sudo usermod -aG docker $USER
```

**Start Docker and enable it on boot:**
```bash
sudo systemctl enable docker --now
```

**Verify Docker works:**
```bash
sudo docker run hello-world
# Expected: "Hello from Docker!" message
```

> You need `sudo docker` for now. The group change only takes effect after you log out and back in.

---

## Step 3 — Python virtualenv

A virtualenv is an isolated Python environment. It means the packages we install don't interfere with the system Python.

```bash
cd ~/elitecode

# Create the virtualenv in a folder called .venv
python3 -m venv .venv

# Install pip itself first
.venv/bin/pip install --upgrade pip

# Install our app's dependencies
.venv/bin/pip install -r requirements.txt
```

**What's in requirements.txt?**
```
fastapi
uvicorn[standard]
httpx
supabase
python-jose[cryptography]
```

After this, `.venv/bin/python` and `.venv/bin/uvicorn` exist and have everything needed.

**Test it works:**
```bash
.venv/bin/python -c "import fastapi; print('FastAPI OK')"
```

---

## Step 4 — Download and configure Judge0

Judge0 is an open source code execution sandbox. It runs your code inside isolated Docker containers so nothing dangerous can escape.

**Create a directory for Judge0:**
```bash
sudo mkdir -p /opt/judge0
cd /opt/judge0
```

**Download the latest release:**
```bash
# Find latest version
LATEST=$(curl -sf https://api.github.com/repos/judge0/judge0/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)
echo "Latest version: $LATEST"

# Download it
curl -L "https://github.com/judge0/judge0/releases/download/${LATEST}/judge0-${LATEST}.zip" \
  -o judge0.zip

# Extract it
sudo unzip judge0.zip
sudo cp -r judge0-${LATEST}/. .
sudo rm -rf judge0.zip judge0-${LATEST}
```

**Set up the config file:**
```bash
sudo cp judge0.conf.example judge0.conf
```

**Generate secure random passwords for Judge0's internal database:**
```bash
REDIS_PASS=$(openssl rand -hex 24)
PG_PASS=$(openssl rand -hex 24)

sudo sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASS}/" judge0.conf
sudo sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PG_PASS}/" judge0.conf
```

> These passwords are for Judge0's internal Redis and Postgres — you never use them directly. They just need to be set to something secure.

**Lock Judge0 to localhost only** (very important — Judge0 must never be public):
```bash
sudo sed -i 's/- "2358:2358"/- "127.0.0.1:2358:2358"/' docker-compose.yml
```

**Verify the change worked:**
```bash
grep "2358" docker-compose.yml
# Should show: - "127.0.0.1:2358:2358"
# NOT: - "2358:2358"
```

---

## Step 5 — Start Judge0

Judge0 is made of several Docker containers working together. Start the database and cache first, then everything else.

```bash
cd /opt/judge0

# Start database and Redis first
sudo docker compose up -d db redis

# Wait ~15 seconds for them to initialise
sleep 15

# Start everything
sudo docker compose up -d
```

**Check all containers are running:**
```bash
sudo docker compose ps
```

You should see something like:
```
NAME              STATUS
judge0-db-1       Up
judge0-redis-1    Up
judge0-server-1   Up
judge0-workers-1  Up
```

**Wait for Judge0 to be ready** (first run pulls ~3GB of Docker images — takes a few minutes):
```bash
# Keep running this until you get a response
curl http://localhost:2358/about
```

Once it responds with JSON, Judge0 is ready.

**Test code execution manually:**
```bash
# Submit a Python "print hello" to Judge0
curl -X POST http://localhost:2358/submissions \
  -H "Content-Type: application/json" \
  -d '{"source_code":"print(\"hello\")", "language_id": 71}'
# Returns: {"token": "some-token"}

# Poll for the result (replace TOKEN)
curl "http://localhost:2358/submissions/TOKEN"
# Returns: {"stdout":"hello\n","status":{"description":"Accepted"}}
```

---

## Step 6 — Configure nginx

nginx sits between the internet and FastAPI. The browser talks to nginx on port 80, and nginx forwards requests to FastAPI on port 8000 (which only listens on localhost).

**Get your VM's external IP:**
```bash
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
```

**Write the nginx config:**
```bash
sudo nano /etc/nginx/sites-available/elitecode
```

Paste this (replace `YOUR_IP` with the IP from above):
```nginx
server {
    listen 80;
    server_name YOUR_IP _;

    client_max_body_size 1m;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   Authorization     $http_authorization;
        proxy_read_timeout 90s;
    }
}
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

**Enable it and disable the default page:**
```bash
sudo ln -sf /etc/nginx/sites-available/elitecode /etc/nginx/sites-enabled/elitecode
sudo rm -f /etc/nginx/sites-enabled/default
```

**Test the config and reload nginx:**
```bash
sudo nginx -t
# Expected: "syntax is ok" and "test is successful"

sudo systemctl reload nginx
```

**Verify nginx is running:**
```bash
sudo systemctl status nginx
```

---

## Step 7 — Run FastAPI (quick test first)

Before setting up the background service, run FastAPI directly in the terminal to confirm it starts.

```bash
cd ~/elitecode
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

You should see:
```
INFO:     Started server process [1234]
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**In a second terminal tab, test it:**
```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","judge0":"http://localhost:2358"}

curl http://localhost/health
# Same result — confirms nginx is proxying correctly
```

Press `Ctrl+C` to stop the test run. Now we'll set it up properly as a background service.

---

## Step 8 — Create a systemd service

Running FastAPI directly in a terminal means it stops the moment you close the SSH session. A systemd service keeps it running permanently — starts on boot, restarts on crash.

**Write the service file:**
```bash
sudo nano /etc/systemd/system/elitecode.service
```

Paste this (replace `YOUR_USERNAME` with your actual username, e.g. `neiltaurogemini`):
```ini
[Unit]
Description=EliteCode FastAPI Backend
After=network.target docker.service
Requires=docker.service

[Service]
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/elitecode
EnvironmentFile=/home/YOUR_USERNAME/elitecode/.env
ExecStart=/home/YOUR_USERNAME/elitecode/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

**What each line means:**

| Line | Meaning |
|---|---|
| `After=network.target docker.service` | Don't start until network and Docker are ready |
| `Requires=docker.service` | If Docker stops, stop this too |
| `User=YOUR_USERNAME` | Run as you, not root |
| `EnvironmentFile=.../.env` | Load your credentials from .env automatically |
| `ExecStart=...uvicorn` | The command to run FastAPI |
| `Restart=always` | If it crashes for any reason, restart it |
| `RestartSec=5` | Wait 5 seconds before restarting |
| `--workers 2` | Run 2 parallel worker processes |

**Load the service file and start it:**
```bash
sudo systemctl daemon-reload        # tell systemd about the new file
sudo systemctl enable elitecode     # start it on every boot
sudo systemctl start elitecode      # start it right now
```

**Check it's running:**
```bash
sudo systemctl status elitecode
# Should show: Active: active (running)
```

**View its logs:**
```bash
sudo journalctl -u elitecode -f
```

---

## Step 9 — Final verification

All three layers working together:

```bash
# 1. Judge0
curl http://localhost:2358/about
# Expected: JSON with Judge0 version

# 2. FastAPI
curl http://localhost:8000/health
# Expected: {"status":"ok","judge0":"http://localhost:2358"}

# 3. nginx → FastAPI
curl http://localhost/health
# Expected: same JSON as above
```

If all three return what's expected — you're done. The backend is fully running.

---

## What you now have vs what setup.sh does

| Manual step | setup.sh equivalent |
|---|---|
| `apt-get install ...` | Step 1 |
| Docker GPG key + repo + install | Step 1 (Docker block) |
| `python3 -m venv .venv` | Step 2 |
| Download Judge0, set config | Step 3 |
| `docker compose up -d` | Step 4 |
| Write nginx config | Step 5 |
| Write systemd service file | Step 6 |
| `systemctl start elitecode` | Step 6 |
| `curl .../health` checks | Step 7 |

`setup.sh` does all of this in one shot with guards so it's safe to re-run. Now you know exactly what it's doing under the hood.
