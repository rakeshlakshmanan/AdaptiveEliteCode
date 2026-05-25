# EliteCode — Architecture Document

**Team Peralata** · CS7IS5 Adaptive Applications · v2.0

---

## 1. Product Overview

EliteCode is an adaptive web application that helps software engineers prepare for coding interviews. Unlike static problem banks (LeetCode, HackerRank), EliteCode tracks each user's mastery across DSA topic patterns and dynamically recommends problems that target their specific weaknesses.

The system adapts in real time — every submission updates the user model, and every recommendation is informed by the user's current skill profile, goals, and interview timeline.

---

## 2. Features

### Core Features (MVP)

| Feature | Description |
|---------|-------------|
| **Adaptive Problem Recommendations** | System selects the next problem based on the user's mastery gaps, target companies, and interview timeline |
| **Code Editor + Execution** | Browser-based Monaco editor with sandboxed code execution against test cases |
| **User Model (Overlay)** | Per-topic, per-difficulty mastery tracking updated via Bayesian Knowledge Tracing after every submission |
| **Stereotype Onboarding** | 3-step onboarding collects experience level, background, goals, and preferences to initialise the user model with meaningful priors |
| **Skill Dashboard** | Radar chart + per-topic mastery breakdown showing what the system believes about the user |
| **Problem Bank** | Curated set seeded from Blind 75, tagged with topics, difficulty, company frequency, and IRT difficulty |
| **Submission Feedback** | Post-submission modal showing mastery change, unlock progression, and next recommendation |
| **Scrutability** | Settings page where users can inspect their model, see strong/weak areas, and reset topic progress |

### Secondary Features

| Feature | Description |
|---------|-------------|
| **Streak Tracking** | Consecutive days with at least one submission |
| **Interview Countdown** | Optional countdown to interview date, influences recommendation urgency |
| **Progress History** | Mastery-over-time line chart and GitHub-style activity heatmap |
| **Company-Weighted Recommendations** | If targeting Google, upweight topics Google asks frequently |
| **Skill Decay** | Mastery decays for topics not practised in 14+ days |
| **Multi-Language Support** | Python, Java, C++, JavaScript, Go in the code editor and execution sandbox |
| **Difficulty Unlocking** | Medium problems in a topic unlock only after Easy mastery exceeds 60% |

---

## 3. User Flows

### 3.1 First-Time User Flow

```
Landing Page
    │
    ▼
Sign Up (GitHub OAuth or email/password via Supabase Auth)
    │
    ▼
Onboarding Step 1: Experience Level + Background + Prior Platform Exp
    │
    ▼
Onboarding Step 2: Target Companies + Interview Timeline
    │
    ▼
Onboarding Step 3: Preferred Language + Weekly Commitment + Start Difficulty
    │
    ▼
[System initialises user_mastery matrix using compound stereotype]
    │
    ▼
Dashboard (first recommendation ready)
```

### 3.2 Core Practice Loop

```
Dashboard
    │
    ├── User clicks recommended problem
    │   OR
    ├── User browses Problem List and picks one
    │
    ▼
Problem Page (description + code editor)
    │
    ├── User writes code
    ├── User clicks "Run" → test against sample cases (no model update)
    ├── User clicks "Submit" → execute against all cases
    │
    ▼
Submission Processing:
    1. Code sent to Podman sandbox on VM
    2. Execute against all test cases (timeout: 10s)
    3. Record submission in DB (pass/fail, time, code, results)
    4. Run BKT update on relevant (topic, difficulty) cells
    5. Check if new difficulty unlocked
    6. Generate next recommendation
    │
    ▼
Post-Submission Modal
    ├── Success: mastery animation, unlock notification, next problem card
    └── Failure: failed cases, adaptive feedback message, try again / hint / skip
    │
    ▼
User chooses: Next Problem → (back to Problem Page)
              Dashboard → (back to Dashboard)
              Try Again → (same Problem Page)
```

### 3.3 Progress Review Flow

```
Dashboard → Progress Page
    │
    ├── View radar chart (overall skill snapshot)
    ├── View per-topic mastery breakdown (Easy/Medium/Hard bars)
    ├── View mastery-over-time chart
    ├── View activity heatmap
    ├── Click "Practice →" on any topic → Problem List filtered to that topic
    │
    ▼
Back to Dashboard
```

### 3.4 Settings / Scrutability Flow

```
Dashboard → Settings → "Your Model"
    │
    ├── View what system believes (strong areas, weak areas, stereotype info)
    ├── Reset a specific topic → mastery re-initialised from stereotype
    ├── Update preferences (companies, timeline, language, commitment)
    │
    ▼
[Model adjustments take effect on next recommendation]
```

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER (Browser)                          │
│               React + Vite + TailwindCSS                    │
│               Monaco Editor, Recharts/D3                    │
│               Supabase JS Client (auth, direct reads)       │
└───────────┬────────────────────────────────┬────────────────┘
            │                                │
            │ REST API calls                 │ Auth (JWT)
            │ (submit, recommend,            │ Direct DB reads
            │  onboarding, progress)         │ (dashboard, progress)
            │                                │
            ▼                                ▼
┌────────────────────────┐     ┌──────────────────────────────┐
│     SINGLE VM          │     │      SUPABASE (hosted)       │
│     (GCP/AWS)          │     │                              │
│                        │     │  ┌────────────────────────┐  │
│  ┌──────────────────┐  │     │  │   Auth (GoTrue)        │  │
│  │  Nginx           │  │     │  │   Email/password       │  │
│  │  (reverse proxy) │  │     │  │   GitHub OAuth         │  │
│  └────────┬─────────┘  │     │  │   JWT tokens           │  │
│           │             │     │  │   Row Level Security   │  │
│  ┌────────▼─────────┐  │     │  └────────────────────────┘  │
│  │  FastAPI          │  │     │  ┌────────────────────────┐  │
│  │  Backend          │◄├─────┤──│   PostgreSQL            │  │
│  │                   │  │     │  │                        │  │
│  │  /api/submit      │  │     │  │   profiles             │  │
│  │  /api/recommend   │  │     │  │   topics               │  │
│  │  /api/onboarding  │  │     │  │   problems             │  │
│  │  /api/progress    │  │     │  │   problem_topics       │  │
│  │  /api/preferences │  │     │  │   user_mastery         │  │
│  └────────┬─────────┘  │     │  │   submissions          │  │
│           │             │     │  │   recommendations      │  │
│  ┌────────▼─────────┐  │     │  └────────────────────────┘  │
│  │  Adaptive Engine  │  │     │  ┌────────────────────────┐  │
│  │  (Python module)  │  │     │  │   Real-time            │  │
│  │                   │  │     │  │   (websocket subs for  │  │
│  │  BKT updater      │  │     │  │    dashboard refresh)  │  │
│  │  IRT calibration  │  │     │  └────────────────────────┘  │
│  │  Recommendation   │  │     │                              │
│  │  pipeline         │  │     └──────────────────────────────┘
│  │  Stereotype init  │  │
│  │  Skill decay      │  │
│  └────────┬─────────┘  │
│           │             │
│  ┌────────▼─────────┐  │
│  │  Code Execution   │  │
│  │  Sandbox          │  │
│  │                   │  │
│  │  Podman containers│  │
│  │  Per-language imgs │  │
│  │  Network disabled │  │
│  │  10s timeout      │  │
│  │  256MB memory cap │  │
│  └──────────────────┘  │
│                        │
└────────────────────────┘
```

### What runs where

| Component | Location | Why there |
|-----------|----------|-----------|
| React frontend | Static deploy (Vercel/Netlify free tier) or Nginx on VM | No server needed |
| Auth | Supabase | Zero-config OAuth, JWT, RLS |
| PostgreSQL | Supabase | Managed, backed up, free tier is plenty |
| FastAPI backend | VM | Custom logic: adaptive engine, code execution |
| Adaptive engine | VM (Python module inside FastAPI) | Needs direct DB access, fast computation |
| Code sandbox | VM (Podman containers) | Needs Linux kernel for container isolation |
| Nginx | VM | Reverse proxy: / → static, /api → FastAPI |

### What we're NOT running

| Dropped | Replaced by | Time saved |
|---------|-------------|------------|
| KeyCloak | Supabase Auth | ~2 days |
| MongoDB | Postgres JSONB columns | ~1 day |
| RabbitMQ | asyncio.Semaphore in FastAPI | ~1 day |
| Docker daemon | Podman (rootless, daemonless) | Simpler, more secure |
| Separate ML service | Python module inside FastAPI | No deployment overhead |

---

## 5. Database Schema

Single Supabase Postgres instance.

### Tables

```sql
-- Extends Supabase auth.users
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    preferred_language TEXT DEFAULT 'python',
    experience_level TEXT DEFAULT 'beginner',
    background TEXT,
    prior_platform_exp TEXT,
    target_companies TEXT[],
    interview_timeline TEXT,
    interview_date DATE,
    weekly_commitment TEXT,
    starting_difficulty TEXT DEFAULT 'easy',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain model vocabulary
CREATE TABLE public.topics (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,          -- 'dynamic_programming'
    display_name TEXT NOT NULL,          -- 'Dynamic Programming'
    tier INT NOT NULL,                   -- 1-4
    description TEXT
);

-- Problem bank
CREATE TABLE public.problems (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL,             -- easy, medium, hard
    starter_code JSONB,                  -- {"python": "def solve():", ...}
    test_cases JSONB NOT NULL,           -- [{"input": "...", "expected": "..."}]
    hidden_test_cases JSONB,             -- same format, not shown to user
    solution_patterns TEXT[],
    company_tags TEXT[],
    company_frequency JSONB,             -- {"google": 0.8, "meta": 0.3}
    source TEXT,                         -- 'blind75', 'neetcode150'
    irt_difficulty FLOAT DEFAULT 0.5,    -- calibrated from population data
    hints JSONB,                         -- ["Think about hash maps", "Two-pass approach", ...]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: problems ↔ topics
CREATE TABLE public.problem_topics (
    problem_id INT REFERENCES public.problems(id) ON DELETE CASCADE,
    topic_id INT REFERENCES public.topics(id) ON DELETE CASCADE,
    PRIMARY KEY (problem_id, topic_id)
);

-- The overlay: user mastery matrix
CREATE TABLE public.user_mastery (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id INT REFERENCES public.topics(id) ON DELETE CASCADE,
    difficulty TEXT NOT NULL,             -- easy, medium, hard
    p_learned FLOAT DEFAULT 0.1,         -- BKT P(L)
    attempts INT DEFAULT 0,
    correct INT DEFAULT 0,
    last_attempted TIMESTAMPTZ,
    last_decayed TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, topic_id, difficulty)
);

-- Submission history
CREATE TABLE public.submissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id INT REFERENCES public.problems(id),
    passed BOOLEAN NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    execution_time_ms INT,
    time_spent_seconds INT,
    test_results JSONB,                  -- [{"case": 1, "passed": true, "output": "..."}]
    hint_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- What was recommended and whether it was attempted
CREATE TABLE public.recommendations (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id INT REFERENCES public.problems(id),
    reason TEXT,                          -- 'weak_topic', 'reinforcement', 'company_priority'
    was_attempted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streak tracking
CREATE TABLE public.streaks (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_active_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security

```sql
-- Users can only access their own data
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

ALTER TABLE public.user_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_mastery" ON public.user_mastery
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_submissions" ON public.submissions
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_recommendations" ON public.recommendations
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_streak" ON public.streaks
    FOR ALL USING (auth.uid() = user_id);

-- Problems and topics are public read
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_problems" ON public.problems
    FOR SELECT USING (true);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_topics" ON public.topics
    FOR SELECT USING (true);

ALTER TABLE public.problem_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_problem_topics" ON public.problem_topics
    FOR SELECT USING (true);
```

### Indexes

```sql
CREATE INDEX idx_submissions_user ON public.submissions(user_id, created_at DESC);
CREATE INDEX idx_user_mastery_user ON public.user_mastery(user_id);
CREATE INDEX idx_problems_difficulty ON public.problems(difficulty);
CREATE INDEX idx_problem_topics_topic ON public.problem_topics(topic_id);
CREATE INDEX idx_recommendations_user ON public.recommendations(user_id, created_at DESC);
```

---

## 6. API Design

All endpoints on the VM FastAPI server. Authenticated endpoints validate Supabase JWT from `Authorization: Bearer <token>` header.

### Auth Flow

```
Browser                    Supabase                    VM (FastAPI)
   │                          │                            │
   │── Sign in (GitHub) ─────►│                            │
   │◄── JWT + session ────────│                            │
   │                          │                            │
   │── API call + JWT ────────┼───────────────────────────►│
   │                          │                  Validate JWT│
   │                          │◄──── JWKS verification ────│
   │                          │                            │
   │◄── Response ─────────────┼────────────────────────────│
```

FastAPI validates JWTs using Supabase's JWKS endpoint. No custom auth logic.

### Endpoints

**Onboarding**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/onboarding` | Submit onboarding data. Creates profile, initialises user_mastery from stereotype, marks onboarding complete. |
| PUT | `/api/preferences` | Update target companies, timeline, language, commitment. |

**Problems**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/problems` | List problems. Query params: `topic`, `difficulty`, `status`, `company`, `recommended_only`. Returns with user's mastery for each problem's topic. |
| GET | `/api/problems/{slug}` | Get full problem details + starter code + hints. |

**Submissions**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit` | Submit code for execution. Body: `{problem_id, language, code, time_spent_seconds}`. Returns test results + mastery update + next recommendation. |
| POST | `/api/run` | Run code against sample test cases only. No model update. Body: `{problem_id, language, code}`. |

**Recommendations**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recommend` | Get next recommended problem(s). Returns problem + reason. |
| POST | `/api/recommend/skip` | User skipped a recommendation. Body: `{recommendation_id}`. Logged for analysis. |

**Progress**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/progress` | Full mastery matrix + aggregate stats (streak, total solved, avg time). |
| GET | `/api/progress/history` | Mastery-over-time data points + activity heatmap data. |
| POST | `/api/progress/reset/{topic_id}` | Reset mastery for a topic. Re-initialises from stereotype. |

### Submission Endpoint Detail

`POST /api/submit` is the most important endpoint. Here's the full flow:

```python
async def submit(request: SubmitRequest, user: User):
    problem = get_problem(request.problem_id)
    
    # 1. Execute code in sandbox
    all_test_cases = problem.test_cases + problem.hidden_test_cases
    results = await execute_code(
        code=request.code,
        language=request.language,
        test_cases=all_test_cases
    )
    
    passed = all(r["passed"] for r in results)
    
    # 2. Record submission
    submission = create_submission(
        user_id=user.id,
        problem_id=problem.id,
        passed=passed,
        language=request.language,
        code=request.code,
        execution_time_ms=sum(r["time_ms"] for r in results),
        time_spent_seconds=request.time_spent_seconds,
        test_results=results,
    )
    
    # 3. Update mastery via BKT
    mastery_updates = []
    for topic_id in get_problem_topics(problem.id):
        old_mastery = get_mastery(user.id, topic_id, problem.difficulty)
        new_p_learned = bkt_update(old_mastery.p_learned, correct=passed)
        update_mastery(user.id, topic_id, problem.difficulty, new_p_learned)
        mastery_updates.append({
            "topic_id": topic_id,
            "difficulty": problem.difficulty,
            "old": old_mastery.p_learned,
            "new": new_p_learned,
            "delta": new_p_learned - old_mastery.p_learned,
        })
    
    # 4. Check difficulty unlock
    unlocks = check_difficulty_unlocks(user.id, problem)
    
    # 5. Update streak
    update_streak(user.id)
    
    # 6. Generate next recommendation
    next_problem = get_recommendation(user.id)
    
    return {
        "passed": passed,
        "test_results": results,  # hide hidden case details on failure
        "mastery_updates": mastery_updates,
        "unlocks": unlocks,
        "next_recommendation": next_problem,
        "submission_id": submission.id,
    }
```

---

## 7. Adaptive Engine

Python module inside FastAPI. This is the core of what we're graded on.

### 7.1 Stereotype Initialisation

On onboarding completion, initialise all `user_mastery` rows:

```python
STEREOTYPE_PRIORS = {
    ("beginner", "cs_undergrad"):     {"t1": 0.15, "t2": 0.05, "t3": 0.02, "t4": 0.01},
    ("beginner", "bootcamp"):         {"t1": 0.10, "t2": 0.03, "t3": 0.01, "t4": 0.01},
    ("beginner", "self_taught"):      {"t1": 0.08, "t2": 0.02, "t3": 0.01, "t4": 0.01},
    ("beginner", "career_switch"):    {"t1": 0.05, "t2": 0.02, "t3": 0.01, "t4": 0.01},
    ("intermediate", "cs_undergrad"): {"t1": 0.60, "t2": 0.30, "t3": 0.10, "t4": 0.05},
    ("intermediate", "bootcamp"):     {"t1": 0.50, "t2": 0.15, "t3": 0.05, "t4": 0.02},
    ("intermediate", "self_taught"):  {"t1": 0.45, "t2": 0.15, "t3": 0.05, "t4": 0.02},
    ("intermediate", "career_switch"):{"t1": 0.35, "t2": 0.10, "t3": 0.03, "t4": 0.01},
    ("advanced", "cs_undergrad"):     {"t1": 0.85, "t2": 0.55, "t3": 0.30, "t4": 0.15},
    ("advanced", "bootcamp"):         {"t1": 0.75, "t2": 0.40, "t3": 0.20, "t4": 0.10},
    ("advanced", "self_taught"):      {"t1": 0.70, "t2": 0.40, "t3": 0.20, "t4": 0.10},
    ("advanced", "career_switch"):    {"t1": 0.60, "t2": 0.30, "t3": 0.15, "t4": 0.08},
}

# Prior platform experience adjusts upward
PLATFORM_MULTIPLIER = {
    "none": 1.0, "under_50": 1.1, "50_to_200": 1.3, "over_200": 1.5
}

def initialise_mastery(user_id, experience, background, platform_exp):
    key = (experience, background)
    priors = STEREOTYPE_PRIORS.get(key, STEREOTYPE_PRIORS[("beginner", "self_taught")])
    multiplier = PLATFORM_MULTIPLIER.get(platform_exp, 1.0)
    
    for topic in get_all_topics():
        tier_key = f"t{topic.tier}"
        base_prior = priors[tier_key] * multiplier
        base_prior = min(base_prior, 0.95)  # cap at 95%
        
        for difficulty in ["easy", "medium", "hard"]:
            # Scale down for higher difficulties
            difficulty_scale = {"easy": 1.0, "medium": 0.6, "hard": 0.3}
            p_learned = base_prior * difficulty_scale[difficulty]
            
            insert_user_mastery(user_id, topic.id, difficulty, p_learned)
```

### 7.2 Bayesian Knowledge Tracing

```python
def bkt_update(p_l: float, correct: bool, 
               p_t=0.15, p_g=0.10, p_s=0.05) -> float:
    """
    Update P(Learned) given an observation.
    
    p_l: current P(Learned)
    correct: whether the submission passed
    p_t: P(Transit) — probability of learning on this attempt
    p_g: P(Guess) — probability of correct answer without knowing
    p_s: P(Slip) — probability of wrong answer despite knowing
    """
    if correct:
        posterior = (p_l * (1 - p_s)) / (p_l * (1 - p_s) + (1 - p_l) * p_g)
    else:
        posterior = (p_l * p_s) / (p_l * p_s + (1 - p_l) * (1 - p_g))
    
    # Transition: account for learning during the attempt
    updated = posterior + (1 - posterior) * p_t
    return round(min(updated, 0.99), 4)
```

BKT parameters by difficulty (harder problems = more learning signal):

| Parameter | Easy | Medium | Hard |
|-----------|------|--------|------|
| P(Transit) | 0.10 | 0.15 | 0.20 |
| P(Guess) | 0.15 | 0.10 | 0.05 |
| P(Slip) | 0.05 | 0.08 | 0.10 |

### 7.3 Skill Decay

```python
def apply_decay(user_id):
    """Run daily or on user login. Decays inactive topics."""
    mastery_rows = get_user_mastery(user_id)
    now = datetime.utcnow()
    
    for row in mastery_rows:
        if row.last_attempted is None:
            continue
        days_inactive = (now - row.last_attempted).days
        if days_inactive > 14:
            decay_periods = (days_inactive - 14) // 7
            decayed = row.p_learned * (0.98 ** decay_periods)
            update_mastery(row.user_id, row.topic_id, row.difficulty, 
                          max(decayed, 0.05))
```

### 7.4 Recommendation Pipeline

```python
def get_recommendation(user_id: str) -> Problem:
    mastery = get_user_mastery(user_id)
    prefs = get_user_preferences(user_id)
    recent = get_recent_submissions(user_id, limit=20)
    recent_problem_ids = {s.problem_id for s in recent}
    
    # Step 1: Apply skill decay
    apply_decay(user_id)
    
    # Step 2: Filter to eligible cells (prerequisite gating)
    #   Don't recommend Medium if Easy < 0.6 for that topic
    eligible = []
    for m in mastery:
        if m.difficulty == "easy":
            eligible.append(m)
        elif m.difficulty == "medium":
            easy_mastery = get_mastery(user_id, m.topic_id, "easy")
            if easy_mastery and easy_mastery.p_learned >= 0.6:
                eligible.append(m)
        elif m.difficulty == "hard":
            medium_mastery = get_mastery(user_id, m.topic_id, "medium")
            if medium_mastery and medium_mastery.p_learned >= 0.6:
                eligible.append(m)
    
    # Step 3: Sort by weakness (lowest mastery first)
    eligible.sort(key=lambda m: m.p_learned)
    
    # Step 4: Apply company weighting
    if prefs.target_companies:
        eligible = apply_company_weights(eligible, prefs.target_companies)
    
    # Step 5: Apply timeline pressure
    #   < 2 weeks: only top 5 weakest cells
    #   1-3 months: top 15
    #   3+ months or exploring: all eligible
    if prefs.interview_timeline == "under_2_weeks":
        eligible = eligible[:5]
    elif prefs.interview_timeline == "1_to_3_months":
        eligible = eligible[:15]
    
    # Step 6: Select target cell (80% weakest, 20% reinforcement)
    if random.random() < 0.8:
        target = eligible[0]
    else:
        moderate = [m for m in mastery if 0.4 < m.p_learned < 0.7]
        target = random.choice(moderate) if moderate else eligible[0]
    
    # Step 7: Pick problem within target cell
    problems = get_problems_for_cell(target.topic_id, target.difficulty)
    problems = [p for p in problems if p.id not in recent_problem_ids]
    
    if not problems:
        # Fallback: allow recently seen if no fresh problems
        problems = get_problems_for_cell(target.topic_id, target.difficulty)
    
    # Pick problem closest to user's ability via IRT
    problem = min(problems, key=lambda p: abs(p.irt_difficulty - target.p_learned))
    
    # Log the recommendation
    log_recommendation(user_id, problem.id, reason=determine_reason(target))
    
    return problem


def apply_company_weights(cells, target_companies):
    """Boost topics that appear frequently at target companies."""
    company_topic_freq = get_company_topic_frequencies(target_companies)
    
    for cell in cells:
        freq = company_topic_freq.get(cell.topic_id, 0.0)
        # Lower the effective mastery for high-frequency topics
        # so they rank higher (appear weaker)
        cell._sort_score = cell.p_learned * (1 - freq * 0.3)
    
    cells.sort(key=lambda m: m._sort_score)
    return cells
```

### 7.5 Difficulty Unlocking

```python
def check_difficulty_unlocks(user_id, problem):
    """Check if solving this problem unlocked a new difficulty."""
    unlocks = []
    for topic_id in get_problem_topics(problem.id):
        if problem.difficulty == "easy":
            mastery = get_mastery(user_id, topic_id, "easy")
            if mastery.p_learned >= 0.6:
                medium_mastery = get_mastery(user_id, topic_id, "medium")
                if medium_mastery.attempts == 0:
                    unlocks.append({
                        "topic_id": topic_id,
                        "unlocked": "medium"
                    })
        elif problem.difficulty == "medium":
            mastery = get_mastery(user_id, topic_id, "medium")
            if mastery.p_learned >= 0.6:
                hard_mastery = get_mastery(user_id, topic_id, "hard")
                if hard_mastery.attempts == 0:
                    unlocks.append({
                        "topic_id": topic_id,
                        "unlocked": "hard"
                    })
    return unlocks
```

---

## 8. Code Execution Sandbox

### Why Podman

Rootless by default (no daemon, no root access needed). CLI-compatible with Docker. Lighter on resources than Docker on a single VM.

### Container Images

Pre-built, stored on VM:

| Image | Base | Purpose |
|-------|------|---------|
| `elitecode-runner:python` | python:3.11-slim | Python execution |
| `elitecode-runner:java` | eclipse-temurin:17-jre-alpine | Java execution |
| `elitecode-runner:cpp` | gcc:13-slim | C++ compile + execute |
| `elitecode-runner:javascript` | node:20-alpine | JavaScript execution |
| `elitecode-runner:go` | golang:1.21-alpine | Go compile + execute |

### Execution Flow

```python
execution_semaphore = asyncio.Semaphore(4)  # max 4 concurrent executions

async def execute_code(code: str, language: str, test_cases: list) -> list:
    async with execution_semaphore:
        results = []
        for i, case in enumerate(test_cases):
            result = await run_single_case(code, language, case, timeout=10)
            results.append({
                "case": i + 1,
                "passed": result.output.strip() == case["expected"].strip(),
                "output": result.output[:1000],  # truncate
                "time_ms": result.time_ms,
                "error": result.stderr[:500] if result.stderr else None,
            })
        return results

async def run_single_case(code, language, test_case, timeout):
    """Execute code in isolated Podman container."""
    
    # Write code and input to temp files
    code_file = write_temp_file(code)
    input_file = write_temp_file(test_case["input"])
    
    cmd = [
        "podman", "run", "--rm",
        f"--timeout={timeout}",
        "--memory=256m",
        "--cpus=0.5",
        "--network=none",
        "--read-only",
        "--pids-limit=50",
        f"-v{code_file}:/solution{ext(language)}:ro",
        f"-v{input_file}:/input.txt:ro",
        f"elitecode-runner:{language}",
        *run_command(language),  # e.g. ["python", "/solution.py"]
    ]
    
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout+2)
        return ExecutionResult(
            output=stdout.decode(),
            stderr=stderr.decode(),
            time_ms=...,  # measure from proc start to end
        )
    except asyncio.TimeoutError:
        proc.kill()
        return ExecutionResult(output="", stderr="Time Limit Exceeded", time_ms=timeout*1000)
    finally:
        cleanup_temp_files(code_file, input_file)
```

### Resource Limits

| Limit | Value | Why |
|-------|-------|-----|
| Timeout | 10 seconds | Prevents infinite loops |
| Memory | 256MB | Prevents memory bombs |
| CPU | 0.5 cores | Doesn't starve the main app |
| Network | Disabled | Prevents exfiltration |
| Filesystem | Read-only | Prevents persistence |
| PIDs | Max 50 | Prevents fork bombs |
| Concurrency | 4 simultaneous | Semaphore-controlled |

---

## 9. Frontend Architecture

### Tech Stack

| Library | Purpose |
|---------|---------|
| React 18 | UI framework |
| Vite | Build tool + dev server |
| TailwindCSS | Styling |
| shadcn/ui | Component library |
| Framer Motion | Animations |
| Monaco Editor | Code editor (VS Code engine) |
| Recharts or D3 | Radar chart, line chart, heatmap |
| Supabase JS | Auth + direct DB reads |
| Axios or fetch | API calls to FastAPI |

### Routing

```
/                    → Landing page
/auth                → Login / Signup
/onboarding          → 3-step wizard (redirects to /dashboard on complete)
/dashboard           → Home (requires auth)
/problems            → Problem list (requires auth)
/problems/:slug      → Problem page (requires auth)
/progress            → Progress detail (requires auth)
/settings            → Settings / Your Model (requires auth)
```

### Data Fetching Strategy

| Data | Source | Method |
|------|--------|--------|
| Auth session | Supabase | `supabase.auth.getSession()` |
| User profile, preferences | Supabase | Direct read via Supabase client (RLS enforced) |
| Mastery for dashboard radar | Supabase | Direct read (real-time subscription for live updates) |
| Problem list | FastAPI | `GET /api/problems` (includes computed mastery per topic) |
| Recommendations | FastAPI | `GET /api/recommend` |
| Submit code | FastAPI | `POST /api/submit` |
| Run tests | FastAPI | `POST /api/run` |
| Progress history | FastAPI | `GET /api/progress/history` (computed aggregates) |

The split: Supabase for simple reads (profile, raw mastery), FastAPI for anything that needs computation (recommendations, submission processing, progress aggregates).

---

## 10. Deployment

### VM Setup (GCP e2-medium or AWS t3.medium)

| Spec | Value |
|------|-------|
| vCPU | 2 |
| RAM | 4GB |
| Disk | 30GB SSD |
| OS | Ubuntu 22.04 LTS |

### Services on VM

```
┌──────────────────────────────────┐
│  Nginx (port 80/443)             │
│  ├── /         → React build     │
│  └── /api/*    → FastAPI :8000   │
├──────────────────────────────────┤
│  FastAPI (port 8000, uvicorn)    │
│  └── Adaptive engine module      │
├──────────────────────────────────┤
│  Podman (rootless)               │
│  └── 5 pre-pulled runner images  │
└──────────────────────────────────┘
```

### Nginx Config

```nginx
server {
    listen 80;
    server_name elitecode.example.com;

    # React static files
    location / {
        root /var/www/elitecode;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }
}
```

### Environment Variables

```bash
# .env on VM
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...        # server-side only, never exposed to frontend
SUPABASE_JWT_SECRET=xxxxx          # for JWT validation
DATABASE_URL=postgresql://...       # Supabase connection string
ALLOWED_ORIGINS=https://elitecode.example.com
```

```bash
# .env for React frontend (public)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...     # public anon key, safe to expose
VITE_API_URL=https://elitecode.example.com/api
```

### Startup

```bash
# FastAPI
cd /opt/elitecode/backend
uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2

# Or use systemd service for auto-restart
```

---

## 11. Problem Seeding

### Initial Dataset: Blind 75

75 problems covering all major DSA topics. Each problem needs:

```json
{
  "title": "Two Sum",
  "slug": "two-sum",
  "description": "Given an array of integers...",
  "difficulty": "easy",
  "starter_code": {
    "python": "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        ",
    "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        \n    }\n}",
    "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};"
  },
  "test_cases": [
    {"input": "[2,7,11,15]\n9", "expected": "[0,1]"},
    {"input": "[3,2,4]\n6", "expected": "[1,2]"}
  ],
  "hidden_test_cases": [
    {"input": "[3,3]\n6", "expected": "[0,1]"},
    {"input": "[1,2,3,4,5]\n9", "expected": "[3,4]"}
  ],
  "hints": [
    "Think about what complement you need for each number.",
    "A hash map can store numbers you've already seen.",
    "One-pass solution: for each number, check if its complement exists in the map."
  ],
  "company_tags": ["google", "amazon", "meta", "apple"],
  "company_frequency": {"google": 0.9, "amazon": 0.85, "meta": 0.8},
  "source": "blind75"
}
```

### Topic Mapping

| Topic | Tier | Example Problems |
|-------|------|-----------------|
| Arrays & Hashing | 1 | Two Sum, Contains Duplicate, Group Anagrams |
| Two Pointers | 1 | Valid Palindrome, 3Sum, Container With Most Water |
| Sliding Window | 1 | Best Time to Buy/Sell Stock, Longest Substring Without Repeating |
| Stack | 1 | Valid Parentheses, Min Stack |
| Binary Search | 2 | Search in Rotated Sorted Array, Find Minimum |
| Trees | 2 | Invert Binary Tree, Max Depth, Level Order Traversal |
| Graphs | 2 | Number of Islands, Clone Graph, Pacific Atlantic |
| Heap / Priority Queue | 2 | Merge K Sorted Lists, Top K Frequent |
| Dynamic Programming | 3 | Climbing Stairs, Coin Change, Longest Common Subsequence |
| Greedy | 3 | Maximum Subarray, Jump Game |
| Backtracking | 3 | Combination Sum, Word Search |
| Intervals | 3 | Merge Intervals, Non-Overlapping Intervals |
| Tries | 4 | Implement Trie, Word Search II |
| Bit Manipulation | 4 | Number of 1 Bits, Counting Bits, Reverse Bits |

---

## 12. Error Handling

| Scenario | Handling |
|----------|----------|
| Code execution timeout | Return "Time Limit Exceeded" with 10s cap |
| Code execution runtime error | Return stderr (truncated to 500 chars) |
| Code execution memory exceeded | Podman kills container, return "Memory Limit Exceeded" |
| Supabase DB unavailable | FastAPI returns 503, frontend shows retry message |
| JWT expired | Supabase client auto-refreshes; if fails, redirect to auth |
| Invalid submission (empty code) | FastAPI validates, returns 400 |
| No problems available for recommendation | Fallback to random unsolved problem |
| User skips all recommendations | Allow free browsing, log skip pattern |
| Podman container fails to start | Retry once, then return 500 with message |
| Concurrent execution limit hit | Queue request, return within 30s or timeout |

---

## 13. Development Timeline

| Week | Phase | What to build | Who |
|------|-------|---------------|-----|
| 6 | Setup | Supabase project (schema, RLS, auth config). React scaffold with routing + auth flow. FastAPI skeleton with JWT validation. Seed Blind 75 problems. | All |
| 7 | Core | Problem display page + Monaco editor integration. Podman sandbox setup (Python first). Onboarding flow (3 steps) + stereotype initialisation. | Frontend: Sayan. Sandbox: Kishore. Onboarding + sterotype: Lukas. |
| 8 | Core | Submission endpoint (execute → record → BKT update). Dashboard with recommendation card + radar chart. Problem list with filters. | Backend: Rakesh. Frontend: Sayan. Problems + data: Vinol. |
| 9 | Adaptation | Full recommendation pipeline (6-step algorithm). Skill decay. Company weighting. Difficulty unlocking. Progress page with charts. | Engine: Rakesh + Lukas. Frontend: Sayan. Data/IRT: Vinol. |
| 10 | Polish | Post-submission modals. Settings/scrutability page. Add Java + C++ execution. UI polish. | All |
| 11 | Test | Integration testing. Bug fixes. Load test sandbox. Demo prep. | All, QA lead: Kishore |
| 12 | Ship | Cloud deployment. Final report. Demo video. Submission. | Deploy: Vinol. Report: All. |
