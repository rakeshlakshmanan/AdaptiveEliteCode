# AdaptiveEliteCode

An adaptive coding interview preparation platform that uses **Bayesian Knowledge Tracing (BKT)** to model each user's skill level per topic and recommend problems in their optimal learning zone.

## What it does

- Onboards users with their experience level, background, and target companies
- Tracks mastery per topic/difficulty using BKT — a probabilistic algorithm that estimates P(learned) from correct/incorrect submissions
- Recommends the next problem based on Zone of Proximal Development (target P(correct) = 0.5–0.8)
- Executes code submissions in a sandboxed Judge0 environment (Python, JS, TS, Java, C++, Go)
- Awards XP, tracks daily streaks, and shows mastery progress charts

## Project structure

```
AdaptiveEliteCode/
├── backend/      FastAPI (Python) — BKT engine, code execution, recommendations
└── frontend/     React + TypeScript (Vite) — UI, code editor, progress views
```

---

## Backend

**Stack:** Python, FastAPI, Supabase, Judge0 CE

### Prerequisites

- Python 3.10+
- A running [Judge0 CE](https://github.com/judge0/judge0) instance
- A [Supabase](https://supabase.com) project

### Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=                          # Leave blank for ECC (uses JWKS)
JUDGE0_URL=http://localhost:2358
FRONTEND_URL=http://localhost:5173            # CORS whitelist, no trailing slash
```

### Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at `http://localhost:8000`. Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/execute` | Submit code — runs tests, updates mastery, awards XP |
| POST | `/onboarding/init-priors` | Initialise mastery priors from user background |
| POST | `/recommendations/refresh` | Get next recommended problem |
| GET | `/health` | Health check |

---

## Frontend

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Monaco Editor, Supabase Auth

### Prerequisites

- Node.js 18+

### Setup

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:8000
```

### Run

```bash
npm run dev
```

App available at `http://localhost:5173`.

```bash
npm run build     # production build
npm run preview   # preview the build locally
```

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login`, `/signup` | Auth |
| `/onboarding` | Background + experience setup |
| `/dashboard` | Main hub with next recommended problem |
| `/problems` | Full problem list |
| `/problems/:slug` | Code editor and submission |
| `/progress` | Mastery charts and history |
| `/profile` | XP, level, streaks |
| `/topic/:topic` | Topic-specific analytics |

---

## Deployment

### Backend — GCP VM

The backend runs on a GCP e2-small VM (Ubuntu **22.04 LTS**) with Judge0 CE running locally on port 2358 and nginx proxying port 80 → 8000.

> **Important:** Use Ubuntu 22.04 LTS, not 24.04. Kernel 6.17 dropped cgroup v1 memory support which breaks Judge0's sandbox.

```bash
# On the VM
chmod +x setup.sh
sudo ./setup.sh
```

`setup.sh` installs Docker, pulls Judge0 CE, sets up a Python virtualenv, configures nginx, and registers a systemd service (`elitecode`) that auto-starts on boot.

Useful commands on the VM:

```bash
sudo systemctl restart elitecode          # restart after code changes
sudo journalctl -u elitecode -f           # live logs
curl http://localhost/health              # verify nginx + FastAPI
curl http://localhost:2358/about          # verify Judge0
```

### Frontend — Cloudflare Pages

Connect the repo to Cloudflare Pages and set the three `VITE_*` environment variables in the dashboard. Every push to the main branch triggers an automatic build and deploy.

---

## BKT Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `P_TRANSIT` | 0.30 | Probability of learning from one attempt |
| `P_SLIP` | 0.10 | Probability of wrong answer despite knowing skill |
| `P_GUESS` | 0.20 | Probability of right answer by luck |
| `P_GUESS_HINTED` | 0.45 | Inflated guess prob when a hint was used |

XP per solve: Easy 50 · Medium 100 · Hard 200