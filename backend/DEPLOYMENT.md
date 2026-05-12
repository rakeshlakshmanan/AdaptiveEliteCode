# EliteCode Backend — Deployment Guide

## What We're Building

```
User writes code in browser
        │
        ▼
Cloudflare Pages (React frontend)
        │  sends code + JWT token
        ▼
FastAPI on GCP VM   ← YOU ARE SETTING THIS UP
        │  calls internally (localhost)
        ▼
Judge0 CE on same VM  (sandboxed code runner)
        │  returns: stdout, errors, runtime
        ▼
FastAPI
        │  compares output vs expected test cases
        │  saves submission to Supabase DB
        │  updates mastery score (BKT algorithm)
        │  awards XP + updates streak
        ▼
Frontend shows real results + XP gained
```

---

## Prerequisites

- Google Cloud account with $300 credits activated
- Supabase project credentials (URL + service role key)
- A free Docker Hub account at hub.docker.com (needed to pull Judge0)

---

## Step 1 — Create the VM in GCP Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **Compute Engine → VM Instances → Create Instance**
2. Fill in:

| Field | Value |
|---|---|
| Name | `elitecode-backend` |
| Region / Zone | `us-central1` / `us-central1-a` |
| Machine type | `e2-small` (2 vCPU, 2 GB RAM) |
| VM provisioning model | **Standard** (NOT Spot — Spot VMs get killed randomly) |
| Boot disk → OS | **Ubuntu 22.04 LTS** ⚠️ |
| Boot disk → Size | 25 GB |
| Firewall | ✅ Allow HTTP traffic |

> ⚠️ **Must be Ubuntu 22.04 LTS, NOT 24.04.**
> Ubuntu 24.04 ships with kernel 6.17 which dropped cgroup v1 memory support.
> Judge0's sandbox (`isolate`) requires cgroup v1 memory to run code.
> Ubuntu 22.04 (kernel 5.15) has full support and works perfectly.

3. Click **Create** and wait ~30 seconds

---

## Step 2 — Tag the VM

GCP Console → **Compute Engine → VM Instances** → click `elitecode-backend` → **Edit** → scroll to **Network tags** → type `elitecode-backend` → **Save**.

This scopes the firewall rule to only this VM.

---

## Step 3 — Firewall rule (skip if you already have `allow-web`)

> If you already created this rule on a previous VM, skip this step — the same rule will apply to the new VM via the tag.

GCP Console → **VPC Network → Firewall → Create Firewall Rule**:

| Field | Value |
|---|---|
| Name | `allow-web` |
| Direction | Ingress |
| Action | Allow |
| Targets | **Specified target tags** |
| Target tags | `elitecode-backend` |
| Source IPv4 ranges | `0.0.0.0/0` |
| Protocols and ports | TCP → `80` |

> Port `2358` (Judge0) is intentionally NOT opened — it only listens on `localhost`.

---

## Step 4 — SSH into the VM

GCP Console → **Compute Engine → VM Instances** → click the **SSH** button next to `elitecode-backend`.

All commands from here run inside that terminal.

---

## Step 5 — Clone the backend repo

```bash
sudo apt-get update && sudo apt-get install -y git nano
git clone https://github.com/adaptive-app-tcd-26/elite-code-backend.git ~/elitecode
```

> **GitHub no longer accepts passwords.** Use a Personal Access Token:
> 1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
> 2. Generate new token (classic) → tick `repo` → copy it
> 3. Use the token as the password when prompted
>
> Or embed it in the URL:
> ```bash
> git clone https://YOUR_TOKEN@github.com/adaptive-app-tcd-26/elite-code-backend.git ~/elitecode
> ```

---

## Step 6 — Fill in your credentials

```bash
cat > ~/elitecode/.env << 'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=
JUDGE0_URL=http://localhost:2358
FRONTEND_URL=https://elite-code-frontend.pages.dev
EOF
```

Verify it:
```bash
cat ~/elitecode/.env
```

### Where to find each value

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API Keys → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → **API Keys** → **"Legacy anon, service_role API keys" tab** → copy the `service_role` key (starts with `eyJ`) |
| `SUPABASE_JWT_SECRET` | Leave blank — new projects use ECC keys fetched automatically |
| `JUDGE0_URL` | Leave as `http://localhost:2358` |
| `FRONTEND_URL` | Your Cloudflare Pages URL |

> ⚠️ **Use the legacy JWT service_role key, NOT the new `sb_secret_*` key.**
> Supabase recently introduced new key formats (`sb_secret_*`). The Python Supabase SDK
> only accepts the old JWT format. Go to API Keys → click **"Legacy anon, service_role API keys"**
> tab → copy the `service_role` value that starts with `eyJ`.

---

## Step 7 — Log into Docker Hub

Judge0's image is 3.3 GB. Without a Docker Hub login, Docker Hub rate-limits the download and it stalls indefinitely.

```bash
sudo docker login -u YOUR_DOCKERHUB_USERNAME
# Enter your Docker Hub password when prompted
```

> Don't have an account? Create a free one at hub.docker.com — takes 2 minutes.

---

## Step 8 — Run the setup script

```bash
cd ~/elitecode
chmod +x setup.sh
sudo ./setup.sh
```

This handles everything:
1. Installs Docker (from Docker's official repo, not Ubuntu's — avoids package conflicts)
2. Configures Docker with GCR mirror (`mirror.gcr.io`) and GCP-correct MTU (1460)
3. Downloads and starts Judge0 CE bound to `localhost:2358`
4. Sets Judge0 passwords (auto-generated, stored in `/opt/judge0/judge0.conf`)
5. Creates Python virtualenv and installs FastAPI dependencies
6. Configures nginx to proxy port 80 → FastAPI on 127.0.0.1:8000
7. Creates systemd service `elitecode` (auto-starts on boot, restarts on crash)

> **Judge0 downloads ~3.3 GB of Docker images on first run.** This is normal — it contains
> compilers for Python, C++, Java, Go, JavaScript, and 60+ other languages.
> With Docker logged in and the GCR mirror configured, it takes 3–5 minutes.
> **Do not interrupt it.**

---

## Step 9 — Verify everything works

```bash
# Judge0 running?
curl http://localhost:2358/about
# Expected: JSON with version info

# FastAPI running?
curl http://localhost:8000/health
# Expected: {"status":"ok","judge0":"http://localhost:2358"}

# nginx proxying?
curl http://localhost/health
# Expected: same JSON as above
```

If FastAPI isn't responding, check logs:
```bash
sudo journalctl -u elitecode -n 30 --no-pager
```

---

## Step 10 — Supabase database migration

The backend uses a `correct_count` column on the `user_mastery` table. Run this in **Supabase Dashboard → SQL Editor** if the column doesn't exist:

```sql
ALTER TABLE public.user_mastery
  ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0;
```

---

## Step 11 — Get the VM's external IP

```bash
curl -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
```

---

## Step 12 — Connect the frontend

**Locally** — edit `d:\XD\2026\elite-code\.env`:
```
VITE_BACKEND_URL=http://YOUR_VM_IP
```

**Cloudflare Pages** → your project → Settings → Environment Variables → add:
```
VITE_BACKEND_URL = http://YOUR_VM_IP
```
Add to both Production and Preview, then trigger a redeploy.

---

## Step 13 — Test end to end

1. Open `https://elite-code-frontend.pages.dev`
2. Go to a problem (e.g. Two Sum)
3. Write a correct solution
4. Click **Run Code** → real test results in a few seconds
5. Click **Submit** → Success modal with XP and mastery score
6. Check Supabase → Table Editor → `submissions` → your row is there

---

## How the adaptive engine works

Every submission triggers **Bayesian Knowledge Tracing (BKT)**:

| Parameter | Value | Meaning |
|---|---|---|
| `P_TRANSIT` | 0.30 | Probability of learning from one attempt |
| `P_SLIP` | 0.10 | Probability of wrong answer even if you know it |
| `P_GUESS` | 0.20 | Probability of right answer by luck |

XP rewards:
| Difficulty | XP |
|---|---|
| Easy | 50 XP |
| Medium | 100 XP |
| Hard | 200 XP |

---

## Day-to-day VM management

```bash
# FastAPI logs
sudo journalctl -u elitecode -f

# Restart FastAPI (after code changes)
sudo systemctl restart elitecode

# Judge0 status
cd /opt/judge0 && sudo docker compose ps

# Pull latest backend code
cd ~/elitecode && git pull && sudo systemctl restart elitecode

# Stop VM to save credits (GCP Console → Stop)
# A stopped VM costs ~$1/month (disk only)
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `curl localhost:2358/about` fails | Judge0 still starting | Wait 60s, retry. Check: `cd /opt/judge0 && sudo docker compose logs server --tail=20` |
| Judge0 "Internal Error" on all submissions | Wrong OS — cgroup v1 memory not available | Must use Ubuntu 22.04 LTS. Ubuntu 24.04 (kernel 6.17) does not support cgroup v1 memory |
| `Failed to create control group /sys/fs/cgroup/memory/` | Same as above — wrong OS | Recreate VM with Ubuntu 22.04 |
| FastAPI `Invalid API key` on startup | Using new `sb_secret_*` key format | Use the legacy JWT key from API Keys → "Legacy anon, service_role API keys" tab |
| FastAPI `supabase.exceptions.APIError: Missing response` | `maybe_single()` throws on 204 in newer postgrest-py | Already fixed in current codebase — `git pull` on VM |
| `column user_mastery.correct_count does not exist` | Missing DB column | Run: `ALTER TABLE user_mastery ADD COLUMN IF NOT EXISTS correct_count integer DEFAULT 0;` in Supabase SQL Editor |
| Docker pull stalls at "Pulling fs layer" | Docker Hub rate limiting or MTU mismatch | Log in: `sudo docker login`. MTU fix is included in setup.sh |
| `502 Bad Gateway` from nginx | FastAPI not running | `sudo journalctl -u elitecode -n 30` — usually a wrong `.env` value |
| `401 Unauthorized` from API | JWT expired | Get fresh token from browser DevTools → Application → Local Storage |
| Judge0 postgres container crash-looping | Empty passwords in judge0.conf | Run: `REDIS_PASS=$(openssl rand -hex 24) && PG_PASS=$(openssl rand -hex 24) && sudo sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASS}/" /opt/judge0/judge0.conf && sudo sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PG_PASS}/" /opt/judge0/judge0.conf` then `sudo docker compose down -v && sudo docker compose up -d` |
| CORS error in browser | `FRONTEND_URL` mismatch | Must exactly match Cloudflare URL (no trailing slash). Restart FastAPI after fix |
