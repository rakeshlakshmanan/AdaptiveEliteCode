# EliteCode VM — Commands Reference

Quick reference for everything you might need to do on the GCP VM.

---

## SSH Into the VM

**Via GCP Console (easiest):**
GCP Console → Compute Engine → VM Instances → click **SSH** next to `elitecode-backend`

**Via gcloud CLI:**
```bash
gcloud compute ssh elitecode-backend --zone=us-central1-a
```

**Via standard SSH (if you added your key):**
```bash
ssh YOUR_VM_EXTERNAL_IP
```

---

## FastAPI Service

```bash
# Status
sudo systemctl status elitecode

# Live logs (follow)
sudo journalctl -u elitecode -f

# Last 50 lines of logs
sudo journalctl -u elitecode -n 50

# Last 100 lines with timestamps
sudo journalctl -u elitecode -n 100 --no-pager

# Logs since last boot
sudo journalctl -u elitecode -b

# Restart (after code changes / .env changes)
sudo systemctl restart elitecode

# Stop / Start
sudo systemctl stop elitecode
sudo systemctl start elitecode

# Check if enabled on boot
sudo systemctl is-enabled elitecode
```

---

## Judge0

```bash
# Check all containers are running
cd /opt/judge0 && sudo docker compose ps

# Live logs from all Judge0 containers
cd /opt/judge0 && sudo docker compose logs -f

# Logs from specific container
cd /opt/judge0 && sudo docker compose logs -f server
cd /opt/judge0 && sudo docker compose logs -f workers

# Restart Judge0 (if unresponsive)
cd /opt/judge0 && sudo docker compose restart

# Stop / Start Judge0
cd /opt/judge0 && sudo docker compose down
cd /opt/judge0 && sudo docker compose up -d

# Check Judge0 is responding
curl http://localhost:2358/about

# Check supported languages (returns big JSON)
curl http://localhost:2358/languages | python3 -m json.tool | head -60
```

---

## nginx

```bash
# Status
sudo systemctl status nginx

# Test config syntax before reloading
sudo nginx -t

# Reload config (no downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# View nginx error log
sudo tail -f /var/log/nginx/error.log

# View nginx access log
sudo tail -f /var/log/nginx/access.log

# View the elitecode nginx config
cat /etc/nginx/sites-available/elitecode
```

---

## Health Checks

```bash
# Judge0 running?
curl http://localhost:2358/about

# FastAPI running?
curl http://localhost:8000/health

# nginx proxying correctly?
curl http://localhost/health

# Full end-to-end test (replace TOKEN with a real JWT from browser DevTools)
curl -X POST http://localhost/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"code":"print(1+1)","language":"python","problem_id":1,"run_only":true}'
```

---

## Updating the Backend

```bash
cd ~/elitecode

# Pull latest code
git pull

# Restart FastAPI to pick up changes
sudo systemctl restart elitecode

# Verify it's running
sudo systemctl status elitecode
curl http://localhost:8000/health
```

---

## .env — Credentials

```bash
# View current .env
cat ~/elitecode/.env

# Edit .env
nano ~/elitecode/.env

# After editing .env, restart FastAPI to pick up changes
sudo systemctl restart elitecode
```

The `.env` file should contain:
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxx
SUPABASE_JWT_SECRET=
JUDGE0_URL=http://localhost:2358
FRONTEND_URL=https://elite-code-frontend.pages.dev
```

---

## Get the VM's External IP

```bash
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
```

---

## Disk & Memory

```bash
# Disk usage
df -h

# Memory usage
free -h

# Top processes by CPU/memory
top

# Docker disk usage (images, containers, volumes)
sudo docker system df
```

---

## Common Problems & Fixes

### FastAPI not starting
```bash
sudo journalctl -u elitecode -n 50 --no-pager
```
Usually a missing or wrong `.env` value. Fix `.env`, then:
```bash
sudo systemctl restart elitecode
```

### Judge0 not responding
```bash
cd /opt/judge0 && sudo docker compose ps
# If containers are down:
sudo docker compose up -d
# If containers are up but unresponsive:
sudo docker compose restart
```

### `curl http://localhost/health` returns 502 Bad Gateway
FastAPI isn't running. Check:
```bash
sudo systemctl status elitecode
sudo journalctl -u elitecode -n 20
```

### `curl http://localhost/health` returns 504 Gateway Timeout
FastAPI is running but taking too long. Check for startup errors in logs.

### `401 Unauthorized` from the API
JWT from browser is expired. Get a fresh one:
- Open browser DevTools → Application → Local Storage → find `sb-*-auth-token`
- Copy the `access_token` value and use that

### CORS error in browser
`FRONTEND_URL` in `.env` must exactly match your Cloudflare Pages URL (no trailing slash). After fixing:
```bash
sudo systemctl restart elitecode
```

### `503 Code execution engine unavailable`
Judge0 is down:
```bash
cd /opt/judge0 && sudo docker compose restart
```

### VM ran out of disk space
```bash
df -h
# Clean up Docker images/caches
sudo docker system prune -f
```

### nginx shows wrong config after editing
```bash
sudo nginx -t        # check for syntax errors
sudo systemctl reload nginx
```

---

## Re-running Setup (if something broke)

The setup script is idempotent — safe to re-run:
```bash
cd ~/elitecode
git pull
sudo ./setup.sh
```

It skips steps already done (e.g. Judge0 won't re-download if `docker-compose.yml` exists).

---

## VM Power Management (save credits)

**Stop the VM when not in use** — a stopped VM costs nothing except the disk (~$1/month).

GCP Console → Compute Engine → VM Instances → tick `elitecode-backend` → **Stop**

To start again: tick the VM → **Start / Resume**

Or via CLI:
```bash
gcloud compute instances stop elitecode-backend --zone=us-central1-a
gcloud compute instances start elitecode-backend --zone=us-central1-a
```

> After starting a stopped VM, give it ~30s then run `sudo systemctl status elitecode` and `curl http://localhost:2358/about` to confirm everything came back up.

---

## Systemd Service File

Location: `/etc/systemd/system/elitecode.service`

```bash
# View the service file
cat /etc/systemd/system/elitecode.service

# After manually editing the service file
sudo systemctl daemon-reload
sudo systemctl restart elitecode
```

---

## Python Dependencies

```bash
# Install / update dependencies after a requirements.txt change
cd ~/elitecode
~/elitecode/.venv/bin/pip install -r requirements.txt
sudo systemctl restart elitecode

# Check installed packages
~/elitecode/.venv/bin/pip list
```
