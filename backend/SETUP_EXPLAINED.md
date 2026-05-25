# setup.sh — Line by Line Explanation

`setup.sh` is the single script that turns a blank Ubuntu 24.04 VM into a fully running EliteCode backend. You run it once. It sets up everything automatically.

---

## Before the script runs

```bash
chmod +x setup.sh && sudo ./setup.sh
```

You run it with `sudo` because it needs to install packages, write system files (`/etc/nginx/...`, `/etc/systemd/...`), and manage services. All of this requires root.

---

## Line 18 — Safety flags

```bash
set -euo pipefail
```

Three bash safety options in one line:

| Flag | What it does |
|---|---|
| `-e` | Stop immediately if any command fails (instead of silently continuing) |
| `-u` | Treat unset variables as errors (prevents bugs like `rm -rf $UNDEFINED/`) |
| `-o pipefail` | If any command in a pipeline fails, the whole pipeline fails (not just the last one) |

Without these, a failed `apt-get install` would be silently ignored and the script would keep going with a broken system.

---

## Lines 20–21 — Figure out who and where

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${SUDO_USER:-$USER}"
```

**`SCRIPT_DIR`** — finds the absolute path to the directory containing `setup.sh`, regardless of where you called it from. This is used throughout the script so paths like `$SCRIPT_DIR/.env` always resolve correctly.

**`APP_USER`** — when you run with `sudo`, `$USER` becomes `root`. But we don't want to run FastAPI as root. `SUDO_USER` is set by sudo to the original user who invoked it (e.g. `neiltaurogemini`), so we use that instead. The `:-$USER` fallback covers the rare case where the script is run directly as root.

---

## Pre-flight check — Does .env exist?

```bash
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "ERROR: .env file not found..."
  exit 1
fi
```

Before touching anything on the system, the script checks that `.env` exists. If it doesn't, it prints an error with instructions and exits immediately. This prevents a scenario where Docker, nginx, and Judge0 all get installed successfully — but FastAPI can't start because the credentials are missing.

---

## Step 1 — System packages

```bash
apt-get install -y -q \
  ca-certificates curl gnupg lsb-release \
  python3-pip python3-venv \
  nginx unzip git nano openssl
```

Installs the base tools needed:

| Package | Why |
|---|---|
| `ca-certificates`, `gnupg` | Needed to verify GPG keys for Docker's apt repo |
| `curl` | Used throughout the script to download things |
| `lsb-release` | Lets us detect the Ubuntu codename (`noble` for 24.04) to pick the right Docker package |
| `python3-pip`, `python3-venv` | For the FastAPI virtualenv |
| `nginx` | The reverse proxy that sits in front of FastAPI |
| `unzip` | To unzip the Judge0 release archive |
| `git`, `nano` | git for pulling updates, nano for editing files on the VM |
| `openssl` | To generate secure random passwords for Judge0's database |

**Why Docker isn't in this list:** Ubuntu 24.04 ships `docker.io` but not `docker-compose-plugin`. For the plugin we need Docker's official repository, added in the next block.

---

### Adding Docker's official apt repository

```bash
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=... signed-by=...] https://download.docker.com/linux/ubuntu noble stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
fi
```

This block is wrapped in `if [ ! -f /etc/apt/keyrings/docker.gpg ]` — it only runs if Docker's GPG key isn't already there. Safe to re-run.

What it does step by step:
1. Downloads Docker's GPG key from `download.docker.com`
2. Converts it to the binary format apt expects (`.gpg`)
3. Adds a new apt source pointing to Docker's package repository for Ubuntu 24.04 (`noble`)
4. Runs `apt-get update` to pick up the new source

Then it installs the actual Docker packages:
```bash
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

| Package | What it is |
|---|---|
| `docker-ce` | Docker Community Edition (the main daemon) |
| `docker-ce-cli` | The `docker` command-line tool |
| `containerd.io` | The low-level container runtime Docker depends on |
| `docker-compose-plugin` | Adds `docker compose` (v2) as a Docker plugin |

```bash
usermod -aG docker "$APP_USER"
systemctl enable docker --now
```

Adds your user to the `docker` group (so you can run `docker` without sudo later), and starts + enables Docker on boot.

---

## Step 2 — Python virtualenv

```bash
python3 -m venv "$SCRIPT_DIR/.venv"
"$SCRIPT_DIR/.venv/bin/pip" install -q --upgrade pip
"$SCRIPT_DIR/.venv/bin/pip" install -q -r "$SCRIPT_DIR/requirements.txt"
```

Creates an isolated Python environment in `.venv/` inside the repo folder. Uses the full path to the venv's pip so it doesn't accidentally install into the system Python.

**Why a virtualenv and not system pip?**
System pip on Ubuntu is intentionally locked down — pip will refuse to install packages globally to avoid breaking system tools. A virtualenv sidesteps this cleanly.

---

## Step 3 — Download Judge0

```bash
JUDGE0_DIR="/opt/judge0"
mkdir -p "$JUDGE0_DIR"
cd "$JUDGE0_DIR"

if [ ! -f "docker-compose.yml" ]; then
  LATEST=$(curl -sf https://api.github.com/repos/judge0/judge0/releases/latest \
    | grep '"tag_name"' | cut -d'"' -f4)
  curl -sL "https://github.com/judge0/judge0/releases/download/${LATEST}/judge0-${LATEST}.zip" \
    -o judge0.zip
  unzip -q judge0.zip
  cp -r judge0-${LATEST}/. .
  rm -rf judge0.zip "judge0-${LATEST}"
fi
```

Judge0 is installed to `/opt/judge0` (separate from your app code). The `if [ ! -f "docker-compose.yml" ]` check means it won't re-download if it's already there — re-running the script is safe.

It queries GitHub's API to always get the latest release version automatically, then downloads and extracts the zip.

---

### Judge0 config — passwords

```bash
if [ ! -f "judge0.conf" ]; then
  cp judge0.conf.example judge0.conf
  REDIS_PASS=$(openssl rand -hex 24)
  PG_PASS=$(openssl rand -hex 24)
  sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASS}/" judge0.conf
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PG_PASS}/" judge0.conf
fi
```

Copies the example config, then generates two 48-character random passwords using `openssl` — one for Redis, one for the Postgres database Judge0 uses internally. These databases are never exposed publicly, but using strong random passwords is good practice.

---

### Lock Judge0 to localhost

```bash
sed -i 's/- "2358:2358"/- "127.0.0.1:2358:2358"/' docker-compose.yml || true
```

By default, Judge0's `docker-compose.yml` binds port 2358 to all network interfaces (`0.0.0.0`) — meaning anyone who knew your IP could send code to it. This line patches the config to bind to `127.0.0.1` only, so Judge0 is only reachable from inside the VM. FastAPI calls it over localhost; no external traffic can ever reach it.

---

## Step 4 — Start Judge0

```bash
docker compose up -d db redis
sleep 15
docker compose up -d
```

Starts the database and Redis first, waits 15 seconds for them to initialise, then starts everything else. Judge0 won't start cleanly if the DB isn't ready.

```bash
for i in $(seq 1 30); do
  if curl -sf http://localhost:2358/about > /dev/null 2>&1; then
    echo "Judge0 is up!"
    break
  fi
  sleep 3
done
```

Polls Judge0's `/about` endpoint up to 30 times (every 3 seconds = 90 seconds max). On first run, Docker has to pull ~1GB of images which takes time. This loop waits instead of barrelling forward with Judge0 still starting.

---

## Step 5 — nginx config

```bash
EXTERNAL_IP=$(curl -sf \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" \
  -H "Metadata-Flavor: Google" 2>/dev/null || echo "_")
```

Queries GCP's metadata server (only reachable from inside a GCP VM) to get the VM's external IP. Used in the nginx config. Falls back to `_` (nginx wildcard) if it can't reach the metadata server.

The nginx config it writes:
```nginx
server {
    listen 80;
    server_name <VM_IP> _;

    client_max_body_size 1m;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Authorization $http_authorization;
        proxy_read_timeout 90s;
    }
}
```

All requests to port 80 are proxied to FastAPI on `127.0.0.1:8000`. The `Authorization` header is explicitly forwarded so the JWT token your browser sends reaches FastAPI.

`client_max_body_size 1m` limits request bodies to 1MB — more than enough for code submissions, protects against oversized uploads.

Then:
```bash
ln -sf /etc/nginx/sites-available/elitecode /etc/nginx/sites-enabled/elitecode
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Enables the config, removes nginx's default placeholder page, and reloads nginx.

---

## Step 6 — systemd service

```bash
cat > /etc/systemd/system/elitecode.service << SERVICE
[Unit]
Description=EliteCode FastAPI Backend
After=network.target docker.service
Requires=docker.service

[Service]
User=neiltaurogemini
WorkingDirectory=/home/neiltaurogemini/elitecode
EnvironmentFile=/home/neiltaurogemini/elitecode/.env
ExecStart=/home/neiltaurogemini/elitecode/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
```

Creates a systemd service so FastAPI:
- Starts automatically when the VM boots
- Restarts automatically within 5 seconds if it crashes
- Runs as your user (not root)
- Loads credentials from `.env`
- Only listens on `127.0.0.1:8000` — nginx is the only thing that talks to it

`--workers 2` means uvicorn runs 2 worker processes. On an e2-small (2 vCPUs) this handles concurrent requests without overloading the VM.

```bash
systemctl daemon-reload
systemctl enable elitecode
systemctl start elitecode
```

Tells systemd about the new service file, enables it on boot, and starts it now.

---

## Step 7 — Verification

```bash
sleep 3
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
  echo "FastAPI is running."
else
  echo "FastAPI not responding yet — check logs:"
  echo "  sudo journalctl -u elitecode -n 30"
fi
```

Waits 3 seconds for FastAPI to start, then hits the `/health` endpoint. If it responds, setup succeeded. If not, it tells you where to look.

---

## What the final state looks like

After the script finishes:

```
Internet
    │  port 80
    ▼
nginx  (listens on 0.0.0.0:80)
    │  proxy_pass
    ▼
FastAPI / uvicorn  (127.0.0.1:8000, 2 workers)
    │  localhost HTTP call
    ▼
Judge0 CE  (127.0.0.1:2358, Docker containers)
    │
    └── server container  ← receives submissions
    └── workers container ← runs the code in isolation
    └── db (Postgres)     ← stores submissions internally
    └── redis             ← job queue between server and workers
```

Port 2358 is never open to the internet. The only public port is 80.

---

## Why it's safe to re-run

Every destructive step is guarded by a check:

| Step | Guard |
|---|---|
| Add Docker GPG key | `if [ ! -f /etc/apt/keyrings/docker.gpg ]` |
| Download Judge0 | `if [ ! -f docker-compose.yml ]` |
| Generate Judge0 passwords | `if [ ! -f judge0.conf ]` |
| Python venv | `python3 -m venv` is idempotent |
| nginx config | Overwrites (safe — same content) |
| systemd service | Overwrites (safe — same content) |

The only thing that resets every run is the Python venv pip install and the nginx/systemd configs being rewritten — which is fine because they're deterministic.
