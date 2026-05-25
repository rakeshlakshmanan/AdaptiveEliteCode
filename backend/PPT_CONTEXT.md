# EliteCode Adaptive System — PPT Context
**Project:** EliteCode — An Adaptive DSA Interview Preparation Platform
**Module:** CS7IS5 Adaptive Applications, Trinity College Dublin
**Team:** Team Peralata

---

## What the System Is

EliteCode is a coding interview prep platform (like LeetCode) that is **adaptive** — instead of showing everyone the same problems, it builds a probabilistic model of each user's knowledge and uses it to recommend the next best problem for that specific user at that specific moment.

---

## The User Model

The user model is a **mastery matrix** — a table stored in the database with one row per `(user, topic, difficulty)` triple.

**Database table: `user_mastery`**

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Who |
| `topic_id` | INT | Which DSA topic (Arrays, Graphs, DP, Trees, etc.) |
| `difficulty` | TEXT | easy / medium / hard |
| `p_learned` | FLOAT [0–1] | Core model value: probability user has learned this skill |
| `attempts` | INT | Total attempts on this cell |
| `correct_count` | INT | Correct attempts |
| `last_attempted` | TIMESTAMPTZ | Used for skill decay |

For a user who has done problems across 10 topics × 3 difficulties = **30 rows**. Each row is a cell in the mastery matrix. Every interaction updates the relevant cells.

---

## Adaptive Component 1: Stereotype-Based Initialisation (Cold-Start)

### Problem Solved
A brand new user has no submission history. Without initialisation, everyone starts at `p_learned = 0.0` for everything — the system can't tell a 5-year veteran from a complete beginner.

### Solution
Onboarding wizard (3 steps) collects:
- **Experience level:** `beginner` / `intermediate` / `advanced`
- **Background:** `cs_undergrad` / `bootcamp` / `self_taught` / `career_switch`
- **Prior platform experience:** `none` / `under_50` / `50_to_200` / `over_200`
- **Target companies:** Google, Amazon, Meta, etc.
- **Interview timeline, weekly commitment, preferred difficulty**

### Base Prior (experience × prior platform exp)

```
("beginner",     "none")      → 0.10
("beginner",     "under_50")  → 0.15
("beginner",     "50_to_200") → 0.20
("intermediate", "none")      → 0.20
("intermediate", "under_50")  → 0.25
("intermediate", "50_to_200") → 0.35
("intermediate", "over_200")  → 0.45
("advanced",     "50_to_200") → 0.45
("advanced",     "over_200")  → 0.55
```

### Background Topic Modifiers (added on top of base prior)

| Background | Topic | Delta |
|------------|-------|-------|
| `cs_undergrad` | Graphs, Dynamic Programming | +0.10 |
| `cs_undergrad` | Trees, Binary Search | +0.08 |
| `cs_undergrad` | Arrays/Hashing, Backtracking, Heap, Tries, Bit Manipulation | +0.05 |
| `bootcamp` | Arrays/Hashing | +0.10 |
| `bootcamp` | Two Pointers, Sliding Window | +0.08 |
| `bootcamp` | Stack | +0.05 |
| `self_taught` | Arrays/Hashing | +0.08 |
| `self_taught` | Two Pointers, Sliding Window | +0.05 |
| `career_switch` | Arrays/Hashing | +0.05 |
| `career_switch` | Two Pointers, Sliding Window | +0.03 |

### Final Prior Formula

```python
p_learned = min(1.0, base_prior + topic_modifier.get(topic_name, 0.0))
```

Written to every `(user, topic, difficulty)` cell in `user_mastery` on onboarding completion.

### Result
An intermediate CS undergrad starts with `p_learned ≈ 0.45` on Graphs/DP. A beginner bootcamp grad starts at `≈ 0.10` on Graphs but `≈ 0.20` on Arrays. The system recommends appropriately without needing 20+ submissions to calibrate.

---

## Adaptive Component 2: Bayesian Knowledge Tracing (BKT)

### What It Is
Every time a user submits code, the system updates `p_learned` for each `(topic, difficulty)` cell relevant to that problem using the BKT algorithm.

### Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `P_TRANSIT` | 0.30 | DSA patterns transfer quickly once understood |
| `P_SLIP` | 0.10 | Rare careless errors; execution is deterministic |
| `P_GUESS` | 0.20 | Partial credit via pattern recognition |
| `P_GUESS_HINTED` | 0.45 | Inflated guess prob when hint used → smaller mastery gain |

### Update Rule

```python
def bkt_update(p_learned, correct, hinted=False):
    p_g = P_GUESS_HINTED if (correct and hinted) else P_GUESS

    if correct:
        denom = p_learned * (1 - P_SLIP) + (1 - p_learned) * p_g
        posterior = (p_learned * (1 - P_SLIP)) / denom
    else:
        denom = p_learned * P_SLIP + (1 - p_learned) * (1 - p_g)
        posterior = (p_learned * P_SLIP) / denom

    return posterior + (1 - posterior) * P_TRANSIT
```

### Two-Step Process
1. **Bayesian posterior update** — accounts for slip (wrong despite knowing) and guess (correct by luck)
2. **Transit** — even after a wrong answer, 30% chance of having learned

### Multi-Topic Problems
If a problem covers both Binary Search AND Two Pointers → both topic cells updated independently.

### Signal Enhancement 1: Hint Penalty
If the user clicked the hint before submitting correctly:
- `P_GUESS` raised from `0.20 → 0.45`
- Correct answer after hint = weaker evidence of genuine mastery → smaller p_learned gain

### Signal Enhancement 2: Time-on-Task Penalty
If the user took unusually long to solve correctly:
- Fetches median solve time from all passing submissions for that problem
- If user time > **2× median** → adds extra slip penalty (up to `+0.15` on `P_SLIP`, capped at `0.40`)
- Penalises slow solves to distinguish genuine mastery from "eventually got there"

```python
ratio = time_spent / median_time
extra_slip = min(0.15, max(0.0, (ratio - 2.0) * 0.05))
effective_p_slip = min(P_SLIP + extra_slip, 0.40)
```

### After Every BKT Update
A daily `mastery_snapshots` row is upserted:
```
overall_mastery = avg(all p_learned values) × 100
```
Powers the progress-over-time line chart.

---

## Adaptive Component 3: Recommendation Pipeline (ZPD)

### What It Is
After every passing submission, the system picks the single best next problem for the user. Runs as a **background task** (non-blocking — user gets their result immediately).

### Goal
Find a problem where predicted success probability falls in the **Zone of Proximal Development**: not too easy (boring, P > 0.8), not too hard (frustrating, P < 0.5).

**Target band: [0.5, 0.8] centred at 0.65**

### Step 1 — Predict Success Probability

```python
def _predict_success(mastery_by_topic, topic_ids, difficulty):
    weight = {"easy": 0.9, "medium": 0.7, "hard": 0.5}[difficulty]
    avg_mastery = mean(mastery_by_topic[tid][difficulty] for tid in topic_ids)
    return avg_mastery * weight + (1 - weight) * P_GUESS
```

- Difficulty weight pulls probability down for harder problems
- `P_GUESS` floor (0.20) prevents predicted probability from hitting zero

### Step 2 — Score Each Problem (lower = better)

```python
if 0.5 <= p_correct <= 0.8:
    score = abs(p_correct - 0.65)             # distance from ideal centre
    if company_match:
        score -= 0.05                          # tiebreaker: prefer target company problems
else:
    score = 1.0 + min(|p - 0.5|, |p - 0.8|)  # out of ZPD → penalty zone
```

### Additional Scoring Modifiers

| Condition | Effect |
|-----------|--------|
| User set `starting_difficulty=easy`, problem is medium/hard | `score += 0.20` |
| Problem topics overlap with last recommendation's topics | `score += 0.30` (interleave penalty) |

The **interleave penalty** prevents recommending the same topic twice in a row, promoting breadth of practice.

### Step 3 — Reason Labels

| Condition | Label | Displayed As |
|-----------|-------|--------------|
| P(correct) < 0.5 | `weak_topic` | "Targeting your weakest area" |
| P(correct) > 0.8 | `reinforcement` | "Consolidating a strong topic" |
| 0.5–0.8 + company match | `company_priority` | "High priority for target companies" |
| 0.5–0.8, no company match | `zpd_match` | ZPD match |

### Result
Stored in `recommendations` table (one row per user, upserted). Frontend reads this to display the recommended problem card on the dashboard.

---

## Adaptive Component 4: Skill Decay

### What It Is
If a user doesn't practice a topic for 14+ days, mastery starts degrading. Based on Ebbinghaus's forgetting curve.

### Formula

```
P(L)_decayed = max( P(L) × (0.98)^k,  0.05 )

k = floor( (days_since_last_attempt - 14) / 7 )
```

- **Grace period:** 14 days of inactivity before decay starts
- **Rate:** 2% reduction per completed 7-day cycle after the grace period
- **Floor:** 0.05 — mastery never drops to zero (some retention always remains)

### When Triggered
- On user login
- When recommendations are generated

### UI Feedback
- Topic cards on Progress page change colour (warning state) when `last_attempted > 14 days`
- Dashboard shows nudge notifications: *"Your Graph skills are getting rusty — practise today"*

---

## Adaptive Component 5: Difficulty Unlocking

### What It Is
Prevents the recommendation engine from suggesting Medium/Hard problems before the user is ready — prerequisite gating.

### Rules

| Lock | Condition to Unlock |
|------|---------------------|
| Medium problems for topic X | `p_learned(X, easy) >= 0.60` |
| Hard problems for topic X | `p_learned(X, medium) >= 0.60` |

**Threshold rationale:** 0.60 mastery on Easy implies ~55%+ predicted success on Medium — putting the learner in the zone of productive struggle.

### UI
Post-submission modal shows unlock notification: *"Medium unlocked for Dynamic Programming!"*

---

## Adaptive Component 6: Scrutability Layer

### What It Is
Users can see and control the system's model of them. Research shows transparency increases trust and engagement in adaptive systems.

### Settings → "Your Model" Tab Exposes

1. **Stereotype applied at onboarding** — e.g. *"Initialised as: Intermediate CS Undergraduate with 50–200 prior problems"*
2. **Full mastery table** — every `(topic, difficulty)` cell showing: `p_learned %`, attempts, correct count, last practised date
3. **Per-topic reset button** — re-initialises that topic back to stereotype priors if the user believes the model has diverged from their true skill state

---

## End-to-End Submission Flow

```
1. User submits code  →  POST /execute
2. JWT validated  →  problem metadata fetched (test cases, difficulty, topic IDs)
3. All test cases run IN PARALLEL against Judge0 sandbox
4. Submission record saved to DB
5. For each topic linked to problem  →  BKT update (with hint + time-on-task signals)
6. Daily mastery snapshot upserted
7. If passed:  XP awarded + streak updated
8. Recommendation generated in BACKGROUND (non-blocking)
   → scores all unsolved problems → picks best ZPD match → upserts to recommendations
9. Response returned to frontend:
   { passed, per-test results, mastery_before%, mastery_after%, mastery_gain, xp_gained }
```

---

## Gamification (Engagement Layer)

| Mechanic | Detail |
|----------|--------|
| **XP** | 50 (easy) / 100 (medium) / 200 (hard) per passing submission |
| **Levels** | 1 level per 500 XP — visible progress bar |
| **Streaks** | Consecutive days with at least one passing submission |
| **Overall Mastery %** | Avg of all `p_learned` values × 100 |
| **Radar Chart** | Spider plot on dashboard — one axis per DSA topic, shows mastery shape at a glance |
| **Progress Chart** | Line graph of daily mastery snapshots over time |
| **Activity Heatmap** | GitHub-style — one cell per day coloured by submission activity |

---

## Adaptive UI Elements

| UI Element | Adaptive Behaviour |
|------------|-------------------|
| Dashboard radar chart | Live reflection of mastery matrix — updates in real-time via Supabase subscriptions |
| Recommended problem card | Shows problem, difficulty, reason label, skip button |
| Post-submission modal (pass) | Animated mastery delta (e.g. "Arrays +12%"), XP earned, unlock notification, next recommendation |
| Post-submission modal (fail) | Adaptive failure message by error type (TLE / WA / Runtime Error) |
| Decay notifications | Topic-specific nudges when last_attempted > 14 days |
| Interview timer widget | Activates ≤ 14 days before interview — "Focus mode: showing your 5 most critical weak spots" |
| Progress page topic cards | Colour-coded by mastery level and decay state |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Code Editor | Monaco Editor (VS Code quality) |
| Charts | Recharts / D3.js (radar, line, heatmap) |
| Backend | FastAPI (Python 3.11), async I/O |
| Database | Supabase (PostgreSQL) — RLS, Realtime |
| Auth | Supabase GoTrue — JWT, Google OAuth |
| Code Execution | Judge0 (self-hosted Docker) — Python, JS, TypeScript, Java, C++, Go |
| Deployment | GCP VM (backend) + Cloudflare Pages (frontend) |
| Reverse Proxy | Nginx |

---

## Limitations Acknowledged

- **Fixed BKT parameters** — not tuned per user/problem; EM-based fitting planned
- **No collaborative filtering** — recommender uses only individual model, not peer data
- **Small problem bank** — NeetCode 75 subset; more problems = better granularity
- **No controlled user study** — no A/B test comparing adaptive vs non-adaptive yet

---

## Key Numbers Summary

| Parameter | Value |
|-----------|-------|
| BKT Transit P(T) | 0.30 |
| BKT Slip P(S) | 0.10 |
| BKT Guess P(G) | 0.20 |
| Hint-inflated Guess | 0.45 |
| ZPD target band | [0.50, 0.80] |
| ZPD ideal centre | 0.65 |
| Difficulty unlock threshold | P(L) ≥ 0.60 |
| Decay grace period | 14 days |
| Decay rate | 2% per 7-day cycle |
| Decay floor | 0.05 |
| Interleave penalty | +0.30 to score |
| XP per level | 500 |
| XP easy/medium/hard | 50 / 100 / 200 |