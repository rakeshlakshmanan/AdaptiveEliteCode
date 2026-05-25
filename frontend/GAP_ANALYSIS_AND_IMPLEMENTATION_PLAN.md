# EliteCode — Gap Analysis & Implementation Plan

**Team Peralata · CS7IS5 · v2.0**

---

## Table of Contents

1. [Architecture → UI Design Gaps](#1-architecture--ui-design-gaps)
2. [UI Design → Architecture Gaps](#2-ui-design--architecture-gaps)
3. [Data Model Mismatches](#3-data-model-mismatches)
4. [Supabase Implementation Plan](#4-supabase-implementation-plan)
   - 4.1 Enable Extensions
   - 4.2 Core Tables (8 tables)
   - 4.3 Indexes
   - 4.4 Triggers
   - 4.5 Helper Functions
   - 4.6 Row Level Security
   - 4.7 `milestones` table (UI addition — Profile badges)
   - 4.8 Additional Indexes for Profile Page
   - 4.9 `get_profile_stats` RPC (UI addition — Profile Page)
   - 4.10 Realtime (user_mastery + streaks + profiles)
   - 4.11 Seed — Topics
   - 4.12 Seed — NeetCode 75 Problems
   - 4.13 Environment Variables
5. [VM Implementation Plan](#5-vm-implementation-plan)
6. [Frontend Wiring Plan](#6-frontend-wiring-plan)
   - Phase 1: Auth Foundation
   - Phase 2: Onboarding
   - Phase 3: Problem Display
   - Phase 4: Submission Loop
   - Phase 5: Dashboard & Progress
   - Phase 6: Settings
   - Phase 7: UI-Only Features (Profile, Topic Detail, Simplified Toggle, Session Banner, XP/Level)

---

## 1. Architecture → UI Design Gaps

> Features and flows **defined in the architecture** that have no corresponding UI design yet. These need to be designed and built.

---

### 1.1 Auth — Google OAuth + Email/Password

**Architecture says:** Supabase Auth with OAuth + email/password. JWT issued by Supabase, passed to FastAPI on every request. Protected routes redirect to login if no session.

**UI design has:** Google OAuth button exists on LoginPage and SignupPage (matches our chosen provider). However:
- No protected route guards — `/dashboard` is accessible without logging in
- No auth state — no session check, no redirect on expiry
- No loading/error states for failed login attempts

**Needs design + build:**
- `ProtectedRoute` wrapper component
- Auth error states on login/signup pages
- Post-login redirect logic: if `onboarding_completed = false` → `/onboarding`, else → `/dashboard`
- Sign out confirmation flow in Settings

---

### 1.2 Onboarding Value Mapping

**Architecture says:** Onboarding data feeds directly into `STEREOTYPE_PRIORS` dict in the adaptive engine. The keys are exact strings like `'cs_undergrad'`, `'under_2_weeks'`, `'over_200'`.

**UI design has:** The 3-step wizard has correct fields but uses human-readable labels (`'CS Student'`, `'Under 2 weeks'`, `'200+'`) not the API-expected snake_case values.

**Needs fix before building:**

| Field | UI label | API value needed |
|-------|----------|-----------------|
| Background | `'CS Student'` | `'cs_undergrad'` |
| Background | `'Career Switcher'` | `'career_switch'` |
| Background | `'Self-Taught'` | `'self_taught'` |
| Background | `'Bootcamp'` | `'bootcamp'` |
| Prior exp | `'under50'` | `'under_50'` |
| Prior exp | `'50-200'` | `'50_to_200'` |
| Prior exp | `'200+'` | `'over_200'` |
| Timeline | `'urgent'` | `'under_2_weeks'` |
| Timeline | `'short'` | `'1_to_3_months'` |
| Timeline | `'medium'` | `'3_plus_months'` |
| Companies | `['FAANG', 'Big Tech']` | `['google', 'amazon', 'meta', ...]` individual slugs |

---

### 1.3 Code Editor — Multi-Language Starter Code

**Architecture says:** Monaco Editor with per-language starter code loaded from `problems.starter_code JSONB` field. Language switcher changes Monaco language mode and replaces editor content.

**UI design has:** Custom textarea editor (Python only). Language dropdown exists but changing it does nothing to the code content or syntax mode.

**Needs design:**
- Monaco editor component replacing current textarea
- Language switcher wired to Monaco's `language` prop
- Warning modal when switching language mid-session: "Switching language will clear your current code"
- Starter code per language displayed when problem loads

---

### 1.4 Post-Submission Modal — Full Response Handling

**Architecture says:** `POST /api/submit` returns `{ passed, test_results, mastery_updates, unlocks, next_recommendation }`. The modal must handle all of these.

**UI design has:** SuccessModal and FailureModal exist but are static — they don't display mastery delta, unlocks, or a next problem card. The FailureModal shows no failed test case details.

**Needs design:**
- SuccessModal: animated mastery delta (e.g. `Arrays +12%`)
- SuccessModal: unlock notification section when `unlocks[]` is non-empty (`"🎉 Medium unlocked for Dynamic Programming!"`)
- SuccessModal: next recommended problem card with reason badge
- FailureModal: failed test case diff (input → expected → got)
- FailureModal: adaptive message based on failure type (TLE, WA, runtime error)

---

### 1.5 Recommendation — Reason Badge + Skip

**Architecture says:** Every recommendation has a `reason` field: `'weak_topic' | 'reinforcement' | 'company_priority'`. Users can skip a recommendation (`POST /api/recommend/skip`).

**UI design has:** Dashboard recommendation card is hardcoded. No reason badge. No skip button.

**Needs design:**
- Reason badge on recommendation card (colour-coded)
- Skip button — triggers next recommendation fetch
- Empty state when no eligible problems exist

---

### 1.6 Skill Decay Indicators

**Architecture says:** Topics not practised for 14+ days decay. `user_mastery.last_attempted` drives this. Users should be aware their mastery is decaying.

**UI design has:** No decay visualisation anywhere. Progress page shows static mastery bars.

**Needs design:**
- "Last practised X days ago" on topic cards in Progress page
- Visual decay indicator (fading/warning colour) when `days_since_last_attempted > 14`
- Tooltip: "Mastery decays for topics you haven't practised in 2+ weeks"
- Dashboard nudge: "Your Graph skills are getting rusty — practise today"

---

### 1.7 Interview Countdown on Dashboard

**Architecture says:** Interview date (set in onboarding or settings) drives recommendation urgency. `< 2 weeks` → top 5 weakest cells only. Should be visible on dashboard.

**UI design has:** Interview date input in Settings. Nothing on dashboard.

**Needs design:**
- Dashboard countdown widget: "Interview in 14 days"
- Urgency mode banner at `< 14 days`: "Focus mode — showing your 5 most critical weak spots"

---

### 1.8 IRT Difficulty Display

**Architecture says:** Each problem has an `irt_difficulty` float `(0–1)` calibrated from population data, separate from the Easy/Medium/Hard label. Used internally for problem selection but also useful for scrutability.

**UI design has:** Only Easy/Medium/Hard badge shown on problem cards and problem page.

**Needs design:**
- Subtle "community difficulty" bar or percentage alongside the difficulty label on problem cards
- Tooltip: "This problem is solved by X% of users who attempt it"

---

### 1.9 Scrutability — Raw Model View

**Architecture says:** Settings → "Your Model" shows the stereotype that was applied, raw `p_learned` per topic per difficulty, and a reset-per-topic button that calls `POST /api/progress/reset/{topic_id}`.

**UI design has:** "Your Model" tab exists with hardcoded strong/weak areas. Reset button calls `console.log()`. No stereotype info shown. No raw numbers.

**Needs design:**
- Stereotype display card: "Initialised as: Intermediate CS Student with 50–200 prior problems"
- Full mastery table: topic × difficulty × p_learned % × attempts × last practised
- Functional reset per topic (confirm dialog → API call)

---

### 1.10 Hidden Test Cases — Not Exposed

**Architecture says:** `problems.hidden_test_cases` are run on submit but never shown to the user (even on failure). Only visible test cases are shown.

**UI design has:** All test cases displayed in the test case panel — no distinction between visible and hidden. On failure, all results shown.

**Needs design:**
- On failure: show results for visible cases with full detail, for hidden cases show only pass/fail count: "2/3 hidden tests passed"
- Never reveal hidden case inputs/expected outputs

---

## 2. UI Design → Architecture Gaps

> Things **designed in the UI** that are not in the architecture. Decisions needed: keep (and add to plan) or cut.

---

### 2.1 Profile Page (`/profile`) — Keep

**What the UI has:** User avatar, display name, XP/level, milestone badges, recent activity.

**Not in architecture:** No `/profile` route planned. Profile data is spread across Settings and Dashboard.

**Decision: Keep.** Good for motivation and gamification. Add to routing. Data sourced from `profiles` + `submissions` + `streaks` via direct Supabase reads.

---

### 2.2 Topic Detail Page (`/topic/:topic`) — Keep

**What the UI has:** Per-topic mastery breakdown, filtered problem list, mastery trend for that topic.

**Not in architecture:** No `/topic/:topic` route planned.

**Decision: Keep.** Natural drill-down from Progress page. Wire to `GET /api/problems?topic=:topic` and direct Supabase `user_mastery` read.

---

### 2.3 Simplified Problem Description Toggle — Keep, Add to Schema

**What the UI has:** Toggle between technical description and plain-English ELI5 version on problem page.

**Not in architecture:** `problems` table has only `description TEXT`.

**Decision: Keep.** Useful accessibility feature. Add `simplified_description TEXT` column to `problems` table.

---

### 2.4 Incomplete Session Banner — Keep, Use localStorage

**What the UI has:** Banner on ProblemsPage reminding user of an in-progress problem.

**Not in architecture:** No "resume session" concept in the DB.

**Decision: Keep. Use `localStorage`** for in-progress state: `{ problem_slug, code, timer_seconds, language }`. No DB change needed for MVP.

---

### 2.5 XP / Level Gamification — Keep, Add to Schema

**What the UI has:** XP bar in Navbar, level badge, XP totals and milestone badges on Profile page.

**Not in architecture:** No XP or level fields in `profiles`.

**Decision: Keep.** Drives engagement. Add `xp INT DEFAULT 0` and `level INT DEFAULT 1` to `profiles`. Award XP server-side on each passing submission.

---

### 2.6 Notification Preferences — Keep as Stub

**What the UI has:** Email/push notification toggles in Settings.

**Not in architecture:** No notification system.

**Decision: Persist the preference, don't build delivery.** Add `email_notifications BOOLEAN DEFAULT true` to `profiles`. No actual notification sending for MVP.

---

## 3. Data Model Mismatches

> Exact places where UI data shapes conflict with the DB schema — will cause breakage on integration.

---

### 3.1 Route Param: `/problem/:id` vs `/problems/:slug`

| | UI | DB / Architecture |
|--|----|-------------------|
| Route | `/problem/:id` | `/problems/:slug` |
| Param | `const { id } = useParams()` | `const { slug } = useParams()` |
| Link | `to={/problem/${p.id}}` | `to={/problems/${p.slug}}` |
| Lookup | Integer `id` | Unique `slug` string |

Fix: Rename route, update all `Link` hrefs, update `useParams` in ProblemSolvePage.

---

### 3.2 Mastery Scale Mismatch

| | UI | DB |
|--|----|----|
| Storage | Integer `0–100` (e.g. `85`) | Float `0.0–1.0` (e.g. `0.85`) |
| Display | Already percentage | Must convert: `Math.round(p_learned * 100)` |
| Radar chart | `[75, 60, 45, 30]` raw ints | `p_learned * 100` per topic |

Fix: All transport/storage uses float. Convert to display percentage only at render.

---

### 3.3 Company Data Shape

| | UI | DB |
|--|----|-----|
| Problem interface | `companies: string[]` flat list | `company_tags TEXT[]` + `company_frequency JSONB` |
| Filter | Tag matching only | Should support frequency-weighted sorting |

Fix: Add `company_frequency: Record<string, number>` to frontend `Problem` type.

---

### 3.4 Problem Source

Architecture uses Blind 75 as the seeding reference. **We are switching to NeetCode 75.** Same topic coverage, better curated, more modern solutions. The schema is identical — only the data changes.

---

## 4. Supabase Implementation Plan

> Run all SQL blocks in the Supabase SQL Editor in the order shown.

---

### 4.1 Enable Extensions

```sql
-- Enable UUID generation (usually on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

### 4.2 Core Tables

```sql
-- ─────────────────────────────────────────────────────────────
-- profiles
-- Extends auth.users. Created automatically by trigger on signup.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
    id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name          TEXT,
    avatar_url            TEXT,
    preferred_language    TEXT        DEFAULT 'python',
    -- onboarding fields
    experience_level      TEXT        DEFAULT 'beginner',     -- beginner | intermediate | advanced
    background            TEXT,                               -- cs_undergrad | bootcamp | self_taught | career_switch
    prior_platform_exp    TEXT        DEFAULT 'none',         -- none | under_50 | 50_to_200 | over_200
    target_companies      TEXT[],                             -- ['google', 'amazon', 'meta']
    interview_timeline    TEXT,                               -- under_2_weeks | 1_to_3_months | 3_plus_months | exploring
    interview_date        DATE,
    weekly_commitment     TEXT        DEFAULT 'steady',       -- casual | steady | intense
    starting_difficulty   TEXT        DEFAULT 'easy',         -- easy | medium
    stereotype_key        TEXT,                               -- e.g. 'intermediate_cs_undergrad' stored for scrutability display
    onboarding_completed  BOOLEAN     DEFAULT FALSE,
    -- gamification (UI addition)
    xp                    INT         DEFAULT 0,
    level                 INT         DEFAULT 1,
    -- preferences (UI addition)
    email_notifications   BOOLEAN     DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- topics
-- Static vocabulary. Seeded once, never changes at runtime.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.topics (
    id           SERIAL      PRIMARY KEY,
    name         TEXT        NOT NULL UNIQUE,   -- 'dynamic_programming'  (snake_case, used as key)
    display_name TEXT        NOT NULL,          -- 'Dynamic Programming'  (shown in UI)
    tier         INT         NOT NULL CHECK (tier BETWEEN 1 AND 4),
    description  TEXT
);

-- ─────────────────────────────────────────────────────────────
-- problems
-- NeetCode 75 seed + any additions.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.problems (
    id                      SERIAL      PRIMARY KEY,
    title                   TEXT        NOT NULL,
    slug                    TEXT        UNIQUE NOT NULL,                          -- 'two-sum' (used in URL)
    description             TEXT        NOT NULL,
    simplified_description  TEXT,                                                 -- ELI5 version (UI addition)
    difficulty              TEXT        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    starter_code            JSONB,                                                -- {"python": "...", "java": "...", "cpp": "...", "javascript": "...", "go": "..."}
    test_cases              JSONB       NOT NULL,                                 -- [{"input": "...", "expected": "..."}]
    hidden_test_cases       JSONB,                                                -- same format, NEVER sent to frontend
    solution_patterns       TEXT[],
    company_tags            TEXT[],                                               -- ['google', 'amazon']
    company_frequency       JSONB,                                                -- {"google": 0.9, "amazon": 0.85}
    source                  TEXT        DEFAULT 'neetcode75',
    irt_difficulty          FLOAT       DEFAULT 0.5 CHECK (irt_difficulty BETWEEN 0 AND 1),
    hints                   JSONB,                                                -- ["Think about hash maps", "Two-pass approach", ...]
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- problem_topics
-- Many-to-many: one problem can cover multiple topics.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.problem_topics (
    problem_id  INT  REFERENCES public.problems(id) ON DELETE CASCADE,
    topic_id    INT  REFERENCES public.topics(id)   ON DELETE CASCADE,
    PRIMARY KEY (problem_id, topic_id)
);

-- ─────────────────────────────────────────────────────────────
-- user_mastery
-- The core overlay: one row per (user, topic, difficulty) cell.
-- BKT p_learned lives here.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.user_mastery (
    user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id       INT         REFERENCES public.topics(id) ON DELETE CASCADE,
    difficulty     TEXT        NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    p_learned      FLOAT       DEFAULT 0.1 CHECK (p_learned BETWEEN 0 AND 1),
    attempts       INT         DEFAULT 0,
    correct        INT         DEFAULT 0,
    last_attempted TIMESTAMPTZ,
    last_decayed   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, topic_id, difficulty)
);

-- ─────────────────────────────────────────────────────────────
-- submissions
-- Every Run and Submit call is recorded.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.submissions (
    id                  SERIAL      PRIMARY KEY,
    user_id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id          INT         REFERENCES public.problems(id),
    passed              BOOLEAN     NOT NULL,
    language            TEXT        NOT NULL,
    code                TEXT        NOT NULL,
    execution_time_ms   INT,
    time_spent_seconds  INT,
    test_results        JSONB,      -- [{"case": 1, "passed": true, "output": "...", "time_ms": 12}]
    hint_used           BOOLEAN     DEFAULT FALSE,
    is_run_only         BOOLEAN     DEFAULT FALSE,   -- TRUE = Run button (no BKT update), FALSE = Submit
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- recommendations
-- Log of every recommendation generated. Tracks if attempted or skipped.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.recommendations (
    id            SERIAL      PRIMARY KEY,
    user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_id    INT         REFERENCES public.problems(id),
    reason        TEXT        CHECK (reason IN ('weak_topic', 'reinforcement', 'company_priority')),
    was_attempted BOOLEAN     DEFAULT FALSE,
    was_skipped   BOOLEAN     DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- streaks
-- One row per user, updated on every passing submission day.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.streaks (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak   INT  DEFAULT 0,
    longest_streak   INT  DEFAULT 0,
    last_active_date DATE,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.3 Indexes

```sql
-- Submissions: most common query is recent submissions per user
CREATE INDEX idx_submissions_user_date    ON public.submissions(user_id, created_at DESC);
CREATE INDEX idx_submissions_problem      ON public.submissions(problem_id);
CREATE INDEX idx_submissions_run_only     ON public.submissions(user_id, is_run_only);

-- User mastery: primary access pattern is all rows for one user
CREATE INDEX idx_user_mastery_user        ON public.user_mastery(user_id);
CREATE INDEX idx_user_mastery_topic       ON public.user_mastery(topic_id);

-- Problems: filter by difficulty and slug lookup
CREATE INDEX idx_problems_difficulty      ON public.problems(difficulty);
CREATE INDEX idx_problems_slug            ON public.problems(slug);
CREATE INDEX idx_problems_source          ON public.problems(source);

-- Problem topics: join in both directions
CREATE INDEX idx_problem_topics_topic     ON public.problem_topics(topic_id);
CREATE INDEX idx_problem_topics_problem   ON public.problem_topics(problem_id);

-- Recommendations: recent per user
CREATE INDEX idx_recommendations_user     ON public.recommendations(user_id, created_at DESC);
```

---

### 4.4 Triggers

```sql
-- ─── updated_at auto-stamp ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── auto-create profile + streak row on signup ───────────────
-- Fires when Supabase Auth creates a new user (Google OAuth or email).
-- raw_user_meta_data contains name + avatar from Google.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.streaks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### 4.5 Helper Functions (called by FastAPI)

```sql
-- ─── Award XP after a passing submission ─────────────────────
-- FastAPI calls this via Supabase service key after BKT update.
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id UUID, p_difficulty TEXT)
RETURNS VOID AS $$
DECLARE
  xp_gain INT;
  new_xp  INT;
BEGIN
  xp_gain := CASE p_difficulty
    WHEN 'easy'   THEN 10
    WHEN 'medium' THEN 25
    WHEN 'hard'   THEN 50
    ELSE 0
  END;

  UPDATE public.profiles
  SET xp    = xp + xp_gain,
      level = GREATEST(1, FLOOR((xp + xp_gain) / 100) + 1)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Update streak after a passing submission ─────────────────
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  today         DATE := CURRENT_DATE;
  last_active   DATE;
  cur_streak    INT;
BEGIN
  SELECT last_active_date, current_streak
  INTO last_active, cur_streak
  FROM public.streaks
  WHERE user_id = p_user_id;

  IF last_active IS NULL OR last_active < today - INTERVAL '1 day' THEN
    -- Gap > 1 day: reset streak
    UPDATE public.streaks
    SET current_streak   = 1,
        longest_streak   = GREATEST(longest_streak, 1),
        last_active_date = today,
        updated_at       = NOW()
    WHERE user_id = p_user_id;

  ELSIF last_active = today - INTERVAL '1 day' THEN
    -- Consecutive day: increment
    UPDATE public.streaks
    SET current_streak   = current_streak + 1,
        longest_streak   = GREATEST(longest_streak, current_streak + 1),
        last_active_date = today,
        updated_at       = NOW()
    WHERE user_id = p_user_id;

  -- If last_active = today, do nothing (already counted today)
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 4.6 Row Level Security

```sql
-- ─── profiles ────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
-- INSERT is handled by SECURITY DEFINER trigger — no INSERT policy needed

-- ─── user_mastery ─────────────────────────────────────────────
ALTER TABLE public.user_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_mastery" ON public.user_mastery
  FOR ALL USING (auth.uid() = user_id);

-- ─── submissions ──────────────────────────────────────────────
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_submissions" ON public.submissions
  FOR ALL USING (auth.uid() = user_id);

-- ─── recommendations ──────────────────────────────────────────
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_recommendations" ON public.recommendations
  FOR ALL USING (auth.uid() = user_id);

-- ─── streaks ──────────────────────────────────────────────────
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_streak" ON public.streaks
  FOR ALL USING (auth.uid() = user_id);

-- ─── problems (public read, admin write) ──────────────────────
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_problems" ON public.problems
  FOR SELECT USING (true);

-- ─── topics (public read) ─────────────────────────────────────
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_topics" ON public.topics
  FOR SELECT USING (true);

-- ─── problem_topics (public read) ────────────────────────────
ALTER TABLE public.problem_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_problem_topics" ON public.problem_topics
  FOR SELECT USING (true);
```

---

### 4.7 Additional Table — milestones (UI addition: Profile Page badges)

The Profile page displays earned milestone badges. These are computed by comparing a user's stats against static threshold definitions. Rather than hardcoding thresholds in the frontend, they live in the DB so they can be updated without a code deploy.

```sql
-- ─────────────────────────────────────────────────────────────
-- milestones
-- Static badge definitions. Seeded once, never mutated at runtime.
-- Badges are computed on the fly by joining against user stats —
-- no per-user badge rows needed.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.milestones (
    id          SERIAL  PRIMARY KEY,
    name        TEXT    NOT NULL,           -- 'First Blood'
    description TEXT    NOT NULL,           -- 'Solve your first problem'
    icon        TEXT    NOT NULL,           -- emoji: '⚔️'
    badge_type  TEXT    NOT NULL CHECK (badge_type IN (
                  'problems_solved',        -- threshold = total distinct problems passed
                  'streak_days',            -- threshold = current or longest streak
                  'xp_total',               -- threshold = total XP accumulated
                  'topic_mastered',         -- threshold = p_learned >= 0.8 for N topics
                  'hard_solved'             -- threshold = hard problems solved
                )),
    threshold   INT     NOT NULL,           -- numeric value to clear
    sort_order  INT     DEFAULT 0           -- display order in Profile page
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_milestones" ON public.milestones
  FOR SELECT USING (true);

CREATE INDEX idx_milestones_type ON public.milestones(badge_type);
```

Seed milestones:

```sql
INSERT INTO public.milestones (name, description, icon, badge_type, threshold, sort_order) VALUES
  ('First Blood',     'Solve your first problem',          '⚔️',  'problems_solved', 1,   1),
  ('Getting Started', 'Solve 10 problems',                 '🌱',  'problems_solved', 10,  2),
  ('Momentum',        'Solve 25 problems',                 '📈',  'problems_solved', 25,  3),
  ('Grinder',         'Solve 50 problems',                 '💪',  'problems_solved', 50,  4),
  ('Century',         'Solve 100 problems',                '💯',  'problems_solved', 100, 5),
  ('On Fire',         'Maintain a 3-day streak',           '🔥',  'streak_days',     3,   6),
  ('Consistent',      'Maintain a 7-day streak',           '📅',  'streak_days',     7,   7),
  ('Dedicated',       'Maintain a 30-day streak',          '🏆',  'streak_days',     30,  8),
  ('Rising',          'Earn 100 XP',                       '⚡',  'xp_total',        100, 9),
  ('Skilled',         'Earn 500 XP',                       '🎯',  'xp_total',        500, 10),
  ('Elite',           'Earn 1000 XP',                      '👑',  'xp_total',        1000,11),
  ('Hard Mode',       'Solve your first hard problem',     '💎',  'hard_solved',     1,   12),
  ('Crusher',         'Solve 5 hard problems',             '🦾',  'hard_solved',     5,   13);
```

---

### 4.8 Additional Index — Profile Page Queries

The Profile page aggregates submission stats. Add indexes to support these queries efficiently.

```sql
-- Profile page: count distinct solved problems per user
CREATE INDEX idx_submissions_user_passed ON public.submissions(user_id, passed)
  WHERE passed = true AND is_run_only = false;

-- Profile page: recent activity feed (last N submissions)
-- Already covered by idx_submissions_user_date

-- Profile page: hard problems solved count
CREATE INDEX idx_submissions_hard ON public.submissions(user_id, problem_id)
  WHERE passed = true AND is_run_only = false;
```

---

### 4.9 Helper Function — Profile Page Stats

The Profile page needs aggregated stats (total solved, solved by difficulty, XP, streak). Rather than multiple round-trips from the frontend, expose a single Supabase RPC call.

```sql
-- Returns all stats needed by the Profile page in one call.
-- Called via: supabase.rpc('get_profile_stats', { p_user_id: uid })
CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_solved',   (
        SELECT COUNT(DISTINCT problem_id)
        FROM public.submissions
        WHERE user_id = p_user_id AND passed = true AND is_run_only = false
    ),
    'easy_solved',    (
        SELECT COUNT(DISTINCT s.problem_id)
        FROM public.submissions s
        JOIN public.problems p ON p.id = s.problem_id
        WHERE s.user_id = p_user_id AND s.passed = true
          AND s.is_run_only = false AND p.difficulty = 'easy'
    ),
    'medium_solved',  (
        SELECT COUNT(DISTINCT s.problem_id)
        FROM public.submissions s
        JOIN public.problems p ON p.id = s.problem_id
        WHERE s.user_id = p_user_id AND s.passed = true
          AND s.is_run_only = false AND p.difficulty = 'medium'
    ),
    'hard_solved',    (
        SELECT COUNT(DISTINCT s.problem_id)
        FROM public.submissions s
        JOIN public.problems p ON p.id = s.problem_id
        WHERE s.user_id = p_user_id AND s.passed = true
          AND s.is_run_only = false AND p.difficulty = 'hard'
    ),
    'current_streak', (SELECT current_streak  FROM public.streaks WHERE user_id = p_user_id),
    'longest_streak', (SELECT longest_streak  FROM public.streaks WHERE user_id = p_user_id),
    'xp',             (SELECT xp              FROM public.profiles WHERE id = p_user_id),
    'level',          (SELECT level           FROM public.profiles WHERE id = p_user_id)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 4.10 Realtime

Enable real-time on `user_mastery` so the Dashboard radar refreshes automatically after a submission without a page reload. Also enable on `profiles` so the Navbar XP bar updates live after a submission.

In Supabase Dashboard → **Database → Replication**:
- Enable replication for `public.user_mastery`
- Enable replication for `public.streaks`
- Enable replication for `public.profiles`

Or via SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_mastery;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streaks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
```

---

### 4.11 Seed — Topics

```sql
INSERT INTO public.topics (name, display_name, tier) VALUES
  ('arrays_hashing',      'Arrays & Hashing',     1),
  ('two_pointers',        'Two Pointers',          1),
  ('sliding_window',      'Sliding Window',        1),
  ('stack',               'Stack',                 1),
  ('binary_search',       'Binary Search',         2),
  ('trees',               'Trees',                 2),
  ('graphs',              'Graphs',                2),
  ('heap',                'Heap / Priority Queue', 2),
  ('dynamic_programming', 'Dynamic Programming',   3),
  ('greedy',              'Greedy',                3),
  ('backtracking',        'Backtracking',          3),
  ('intervals',           'Intervals',             3),
  ('tries',               'Tries',                 4),
  ('bit_manipulation',    'Bit Manipulation',      4);
```

---

### 4.12 Seed — NeetCode 75 Problems

The NeetCode 75 is the canonical problem set for this project (replaces Blind 75 from the original architecture doc). It covers all 14 topic areas above. Below is the full list mapped to topics, difficulty, and slug. Test cases, starter code, hints, and company data are populated via a separate seeding script.

**Arrays & Hashing (Easy)**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 1 | Contains Duplicate | `contains-duplicate` | Easy |
| 2 | Valid Anagram | `valid-anagram` | Easy |
| 3 | Two Sum | `two-sum` | Easy |
| 4 | Group Anagrams | `group-anagrams` | Medium |
| 5 | Top K Frequent Elements | `top-k-frequent-elements` | Medium |
| 6 | Encode and Decode Strings | `encode-and-decode-strings` | Medium |
| 7 | Product of Array Except Self | `product-of-array-except-self` | Medium |
| 8 | Longest Consecutive Sequence | `longest-consecutive-sequence` | Medium |

**Two Pointers**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 9 | Valid Palindrome | `valid-palindrome` | Easy |
| 10 | 3Sum | `3sum` | Medium |
| 11 | Container With Most Water | `container-with-most-water` | Medium |

**Sliding Window**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 12 | Best Time to Buy and Sell Stock | `best-time-to-buy-and-sell-stock` | Easy |
| 13 | Longest Substring Without Repeating Characters | `longest-substring-without-repeating-characters` | Medium |
| 14 | Longest Repeating Character Replacement | `longest-repeating-character-replacement` | Medium |
| 15 | Minimum Window Substring | `minimum-window-substring` | Hard |

**Stack**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 16 | Valid Parentheses | `valid-parentheses` | Easy |
| 17 | Min Stack | `min-stack` | Medium |
| 18 | Evaluate Reverse Polish Notation | `evaluate-reverse-polish-notation` | Medium |
| 19 | Generate Parentheses | `generate-parentheses` | Medium |
| 20 | Daily Temperatures | `daily-temperatures` | Medium |
| 21 | Car Fleet | `car-fleet` | Medium |
| 22 | Largest Rectangle in Histogram | `largest-rectangle-in-histogram` | Hard |

**Binary Search**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 23 | Binary Search | `binary-search` | Easy |
| 24 | Search a 2D Matrix | `search-a-2d-matrix` | Medium |
| 25 | Koko Eating Bananas | `koko-eating-bananas` | Medium |
| 26 | Find Minimum in Rotated Sorted Array | `find-minimum-in-rotated-sorted-array` | Medium |
| 27 | Search in Rotated Sorted Array | `search-in-rotated-sorted-array` | Medium |
| 28 | Time Based Key-Value Store | `time-based-key-value-store` | Medium |

**Trees**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 29 | Invert Binary Tree | `invert-binary-tree` | Easy |
| 30 | Maximum Depth of Binary Tree | `maximum-depth-of-binary-tree` | Easy |
| 31 | Diameter of Binary Tree | `diameter-of-binary-tree` | Easy |
| 32 | Balanced Binary Tree | `balanced-binary-tree` | Easy |
| 33 | Same Tree | `same-tree` | Easy |
| 34 | Subtree of Another Tree | `subtree-of-another-tree` | Easy |
| 35 | Lowest Common Ancestor of BST | `lowest-common-ancestor-of-a-binary-search-tree` | Medium |
| 36 | Binary Tree Level Order Traversal | `binary-tree-level-order-traversal` | Medium |
| 37 | Binary Tree Right Side View | `binary-tree-right-side-view` | Medium |
| 38 | Count Good Nodes in Binary Tree | `count-good-nodes-in-binary-tree` | Medium |
| 39 | Validate Binary Search Tree | `validate-binary-search-tree` | Medium |
| 40 | Kth Smallest Element in a BST | `kth-smallest-element-in-a-bst` | Medium |
| 41 | Construct Binary Tree from Preorder and Inorder | `construct-binary-tree-from-preorder-and-inorder-traversal` | Medium |
| 42 | Binary Tree Maximum Path Sum | `binary-tree-maximum-path-sum` | Hard |
| 43 | Serialize and Deserialize Binary Tree | `serialize-and-deserialize-binary-tree` | Hard |

**Heap / Priority Queue**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 44 | Kth Largest Element in a Stream | `kth-largest-element-in-a-stream` | Easy |
| 45 | Last Stone Weight | `last-stone-weight` | Easy |
| 46 | K Closest Points to Origin | `k-closest-points-to-origin` | Medium |
| 47 | Kth Largest Element in an Array | `kth-largest-element-in-an-array` | Medium |
| 48 | Task Scheduler | `task-scheduler` | Medium |
| 49 | Design Twitter | `design-twitter` | Medium |
| 50 | Find Median from Data Stream | `find-median-from-data-stream` | Hard |

**Graphs**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 51 | Number of Islands | `number-of-islands` | Medium |
| 52 | Clone Graph | `clone-graph` | Medium |
| 53 | Max Area of Island | `max-area-of-island` | Medium |
| 54 | Pacific Atlantic Water Flow | `pacific-atlantic-water-flow` | Medium |
| 55 | Surrounded Regions | `surrounded-regions` | Medium |
| 56 | Rotting Oranges | `rotting-oranges` | Medium |
| 57 | Walls and Gates | `walls-and-gates` | Medium |
| 58 | Course Schedule | `course-schedule` | Medium |
| 59 | Course Schedule II | `course-schedule-ii` | Medium |
| 60 | Redundant Connection | `redundant-connection` | Medium |
| 61 | Number of Connected Components | `number-of-connected-components-in-an-undirected-graph` | Medium |
| 62 | Graph Valid Tree | `graph-valid-tree` | Medium |
| 63 | Word Ladder | `word-ladder` | Hard |

**Intervals**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 64 | Insert Interval | `insert-interval` | Medium |
| 65 | Merge Intervals | `merge-intervals` | Medium |
| 66 | Non-overlapping Intervals | `non-overlapping-intervals` | Medium |
| 67 | Meeting Rooms | `meeting-rooms` | Easy |
| 68 | Meeting Rooms II | `meeting-rooms-ii` | Medium |
| 69 | Minimum Interval to Include Each Query | `minimum-interval-to-include-each-query` | Hard |

**Greedy**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 70 | Maximum Subarray | `maximum-subarray` | Medium |
| 71 | Jump Game | `jump-game` | Medium |
| 72 | Jump Game II | `jump-game-ii` | Medium |

**Backtracking**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 73 | Combination Sum | `combination-sum` | Medium |
| 74 | Word Search | `word-search` | Medium |

**Dynamic Programming**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 75 | Climbing Stairs | `climbing-stairs` | Easy |
| 76 | House Robber | `house-robber` | Medium |
| 77 | Longest Common Subsequence | `longest-common-subsequence` | Medium |
| 78 | Word Break | `word-break` | Medium |
| 79 | Coin Change | `coin-change` | Medium |
| 80 | Partition Equal Subset Sum | `partition-equal-subset-sum` | Medium |
| 81 | Unique Paths | `unique-paths` | Medium |

**Tries**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 82 | Implement Trie | `implement-trie-prefix-tree` | Medium |
| 83 | Design Add and Search Words Data Structure | `design-add-and-search-words-data-structure` | Medium |
| 84 | Word Search II | `word-search-ii` | Hard |

**Bit Manipulation**
| # | Title | Slug | Difficulty |
|---|-------|------|------------|
| 85 | Single Number | `single-number` | Easy |
| 86 | Number of 1 Bits | `number-of-1-bits` | Easy |
| 87 | Counting Bits | `counting-bits` | Easy |
| 88 | Reverse Bits | `reverse-bits` | Easy |
| 89 | Missing Number | `missing-number` | Easy |
| 90 | Sum of Two Integers | `sum-of-two-integers` | Medium |

> **Note:** The actual NeetCode 75 list has some problems that require premium LeetCode access (Walls and Gates, Meeting Rooms, etc.). These should be described from scratch with original test cases to avoid copyright issues. All problem data (descriptions, test cases, hints, starter code) will be written by the team — do not copy-paste from LeetCode.

---

### 4.13 Supabase Environment Variables

```bash
# .env on VM (never commit this)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...          # Service role key — full DB access, server only
SUPABASE_JWT_SECRET=xxxx             # From Supabase Dashboard → Settings → API → JWT Secret
DATABASE_URL=postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres

# .env for React frontend (safe to be public)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...        # Anon/public key — RLS enforced
VITE_API_URL=https://elitecode.example.com/api
```

---

## 5. VM Implementation Plan

> Single VM on GCP (e2-medium) or AWS (t3.medium). Runs Nginx, FastAPI, and Podman.

---

### 5.1 VM Specs

| Spec | Value | Notes |
|------|-------|-------|
| Provider | GCP e2-medium or AWS t3.medium | Either works, ~$20–30/month |
| vCPU | 2 | Shared, enough for this workload |
| RAM | 4 GB | Podman containers + FastAPI + Nginx |
| Disk | 30 GB SSD | OS + Docker images + code |
| OS | Ubuntu 22.04 LTS | LTS for stability |
| Ports open | 80, 443, 22 | HTTP, HTTPS, SSH |

---

### 5.2 Initial Server Setup

```bash
# 1. Update and install base packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx python3 python3-pip python3-venv git curl unzip ufw

# 2. Firewall rules
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# 3. Create app user (don't run as root)
sudo useradd -m -s /bin/bash elitecode
sudo usermod -aG sudo elitecode

# 4. Install Podman (rootless, no daemon)
sudo apt install -y podman

# Verify
podman --version
nginx -v
python3 --version
```

---

### 5.3 FastAPI Backend Setup

```bash
# As the elitecode user
cd /opt
sudo mkdir elitecode && sudo chown elitecode:elitecode elitecode
cd elitecode

# Clone repo
git clone https://github.com/your-org/elitecode.git .

# Create virtualenv
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install fastapi uvicorn[standard] supabase python-jose[cryptography] httpx asyncpg

# Create .env file
nano /opt/elitecode/backend/.env
# (paste env vars from Section 4.10)
```

---

### 5.4 FastAPI systemd Service

Create `/etc/systemd/system/elitecode-api.service`:

```ini
[Unit]
Description=EliteCode FastAPI Backend
After=network.target
Wants=network.target

[Service]
Type=simple
User=elitecode
WorkingDirectory=/opt/elitecode/backend
Environment="PATH=/opt/elitecode/venv/bin"
EnvironmentFile=/opt/elitecode/backend/.env
ExecStart=/opt/elitecode/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable elitecode-api
sudo systemctl start elitecode-api
sudo systemctl status elitecode-api
```

---

### 5.5 Podman Container Images

Build and pre-pull all 5 runner images. These live on the VM — no external registry needed.

**Directory structure:**

```
/opt/elitecode/sandbox/
├── Dockerfile.python
├── Dockerfile.java
├── Dockerfile.cpp
├── Dockerfile.javascript
└── Dockerfile.go
```

**Dockerfiles:**

```dockerfile
# Dockerfile.python
FROM python:3.11-slim
RUN useradd -m runner
USER runner
WORKDIR /sandbox
```

```dockerfile
# Dockerfile.java
FROM eclipse-temurin:17-jre-alpine
RUN adduser -D runner
USER runner
WORKDIR /sandbox
```

```dockerfile
# Dockerfile.cpp
FROM gcc:13-slim
RUN useradd -m runner
USER runner
WORKDIR /sandbox
```

```dockerfile
# Dockerfile.javascript
FROM node:20-alpine
RUN adduser -D runner
USER runner
WORKDIR /sandbox
```

```dockerfile
# Dockerfile.go
FROM golang:1.21-alpine
RUN adduser -D runner
USER runner
WORKDIR /sandbox
```

**Build and tag:**

```bash
cd /opt/elitecode/sandbox

podman build -f Dockerfile.python     -t elitecode-runner:python
podman build -f Dockerfile.java       -t elitecode-runner:java
podman build -f Dockerfile.cpp        -t elitecode-runner:cpp
podman build -f Dockerfile.javascript -t elitecode-runner:javascript
podman build -f Dockerfile.go         -t elitecode-runner:go

# Verify all images exist
podman images | grep elitecode-runner
```

---

### 5.6 Nginx Configuration

Build the React frontend and serve statically. API proxied to FastAPI.

```bash
# Build frontend
cd /opt/elitecode/frontend
npm run build                  # or pnpm build
sudo cp -r dist/* /var/www/elitecode/
```

Create `/etc/nginx/sites-available/elitecode`:

```nginx
server {
    listen 80;
    server_name elitecode.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name elitecode.example.com;

    ssl_certificate     /etc/letsencrypt/live/elitecode.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/elitecode.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # React SPA — serve index.html for all routes (client-side routing)
    location / {
        root /var/www/elitecode;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # API proxy to FastAPI
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 35s;              # > 30s submission timeout
        proxy_connect_timeout 5s;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|svg|woff2|ico)$ {
        root  /var/www/elitecode;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/elitecode /etc/nginx/sites-enabled/
sudo nginx -t          # test config
sudo systemctl reload nginx
```

---

### 5.7 SSL — Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d elitecode.example.com
# Follow prompts. Auto-renewal is set up by Certbot.
sudo systemctl status certbot.timer   # verify renewal timer
```

---

### 5.8 Podman — Rootless Setup for elitecode User

```bash
# Allow elitecode user to run Podman rootlessly
sudo loginctl enable-linger elitecode

# As elitecode user — verify rootless works
su - elitecode
podman run --rm hello-world
```

---

### 5.9 Code Execution Resource Limits (per container)

| Limit | Value | Enforced by |
|-------|-------|-------------|
| Wall-clock timeout | 10 seconds | `asyncio.wait_for` + `asyncio.TimeoutError` |
| Memory | 256 MB | `--memory=256m` Podman flag |
| CPU | 0.5 cores | `--cpus=0.5` Podman flag |
| Network | Disabled | `--network=none` Podman flag |
| Filesystem | Read-only root | `--read-only` Podman flag |
| PIDs | 50 | `--pids-limit=50` Podman flag |
| Concurrent executions | 4 | `asyncio.Semaphore(4)` in FastAPI |

---

### 5.10 Deployment Checklist

Run through this in order on each deployment:

```
[ ] git pull latest on VM
[ ] pnpm build in /opt/elitecode/frontend
[ ] cp -r dist/* /var/www/elitecode/
[ ] pip install -r requirements.txt (if deps changed)
[ ] sudo systemctl restart elitecode-api
[ ] sudo systemctl reload nginx
[ ] curl https://elitecode.example.com/api/health → should return {"status": "ok"}
[ ] Open browser → verify landing page loads
[ ] Open browser → verify /dashboard loads (auth check)
[ ] Test one submission end-to-end
```

---

### 5.11 VM Environment Variables

```bash
# /opt/elitecode/backend/.env (on VM — never committed to git)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=xxxx
DATABASE_URL=postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres
ALLOWED_ORIGINS=https://elitecode.example.com
ENVIRONMENT=production
MAX_CONCURRENT_EXECUTIONS=4
```

---

## 6. Frontend Wiring Plan

> 71 discrete tasks across 7 phases. Each phase is independently deployable. UI already exists — these tasks connect it to real data. Phases 1–6 cover architecture features; Phase 7 covers the 6 UI-only features from Section 2.

**Status (as of 2026-03-20):**
- ✅ Phase 1 — Auth Foundation (Supabase client, AuthContext, ProtectedRoute, Login, Signup)
- ✅ Phase 2 — Onboarding Wiring (value mapping, Supabase save, skip handler, confetti)
- ✅ Phase 3 — Problem Display (ProblemsPage reads DB, ProblemSolvePage loads by slug, CodeEditor reset, IncompleteSessionBanner prop fix)
- ✅ Phase 4 — Dashboard & Progress (DashboardPage, ProgressPage, ProfilePage, SettingsPage all wired to Supabase; Navbar shows real XP/level/initials)
- ⬜ Phase 5 — Submission Loop (POST /api/run, POST /api/submit, mastery_updates, SuccessModal wiring — blocked on FastAPI backend)
- ⬜ Phase 6 — Recommendations API (GET /api/recommend — blocked on FastAPI backend; dashboard shows DB recommendations if seeded)
- ⬜ Phase 7 — UI-Only Features (Topic detail Supabase wiring, activity heatmap from real data, notification columns migration)

**Pending Supabase schema additions needed:**
- `user_milestones(user_id UUID, milestone_id INT, earned_at TIMESTAMPTZ)` — referenced in ProfilePage
- `profiles.notification_email BOOLEAN DEFAULT TRUE` — referenced in SettingsPage
- `profiles.notification_push BOOLEAN DEFAULT FALSE` — referenced in SettingsPage

---

### Phase 1 — Auth Foundation (nothing else works without this)

| # | Task | File(s) |
|---|------|---------|
| 1 | Install `@supabase/supabase-js` | `package.json` |
| 2 | Create Supabase client | `src/lib/supabase.ts` *(new)* |
| 3 | Create API client with JWT auto-injection | `src/lib/api.ts` *(new)* |
| 4 | Create `AuthContext` + `useAuth` hook | `src/app/context/AuthContext.tsx` *(new)* |
| 5 | Create `ProtectedRoute` component | `src/app/components/ProtectedRoute.tsx` *(new)* |
| 6 | Wrap auth-required routes with `ProtectedRoute` | `src/app/routes.tsx` |
| 7 | Wire LoginPage Google OAuth button | `LoginPage.tsx` |
| 8 | Wire LoginPage email/password form | `LoginPage.tsx` |
| 9 | Wire SignupPage email/password form | `SignupPage.tsx` |
| 10 | Post-login redirect: check `onboarding_completed` | `AuthContext.tsx` |
| 11 | Create `.env` with Supabase + API keys | `.env` *(new)* |

---

### Phase 2 — Onboarding → User Model Init

| # | Task | File(s) |
|---|------|---------|
| 12 | Normalise all form values to API snake_case format | `OnboardingPage.tsx` |
| 13 | Map company group labels to individual company slugs | `OnboardingPage.tsx` |
| 14 | Call `POST /api/onboarding` on step 3 submit | `OnboardingPage.tsx` |
| 15 | Show loading state during API call, confetti on success | `OnboardingPage.tsx` |
| 16 | Handle API error — show message, allow retry | `OnboardingPage.tsx` |

---

### Phase 3 — Problem Display

| # | Task | File(s) |
|---|------|---------|
| 17 | Fix route: `/problem/:id` → `/problems/:slug` | `routes.tsx`, all `Link` hrefs |
| 18 | Install `@monaco-editor/react` | `package.json` |
| 19 | Replace textarea editor with Monaco, language prop wired | `CodeEditor.tsx` |
| 20 | Call `GET /api/problems` with filter query params | `ProblemsPage.tsx` |
| 21 | Pagination connected to real total count from API | `ProblemsPage.tsx` |
| 22 | Call `GET /api/problems/:slug` to load problem detail | `ProblemSolvePage.tsx` |
| 23 | Load per-language starter code from `starter_code` JSONB | `ProblemSolvePage.tsx` |
| 24 | Language switch warns + loads new starter code | `ProblemSolvePage.tsx` |
| 25 | In-progress session saved to + restored from `localStorage` | `ProblemSolvePage.tsx` |
| 26 | Hide hidden test case input/expected, show only pass/fail count | `ProblemSolvePage.tsx` |

---

### Phase 4 — Submission Loop

| # | Task | File(s) |
|---|------|---------|
| 27 | Wire "Run" button → `POST /api/run` (no BKT update) | `ProblemSolvePage.tsx` |
| 28 | Wire "Submit" button → `POST /api/submit` with timer value | `ProblemSolvePage.tsx` |
| 29 | Track `hint_used = true` when hint section is opened | `ProblemSolvePage.tsx` |
| 30 | SuccessModal receives + animates `mastery_updates` delta | `SuccessModal.tsx` |
| 31 | SuccessModal shows unlock notification from `unlocks[]` | `SuccessModal.tsx` |
| 32 | SuccessModal shows next recommended problem card | `SuccessModal.tsx` |
| 33 | FailureModal shows failed test case diff (input/expected/got) | `FailureModal.tsx` |

---

### Phase 5 — Dashboard & Progress (Live Data)

| # | Task | File(s) |
|---|------|---------|
| 34 | Call `GET /api/recommend` on mount, show reason badge | `DashboardPage.tsx` |
| 35 | Skip button → `POST /api/recommend/skip` → refetch | `DashboardPage.tsx` |
| 36 | Direct Supabase read: `user_mastery` → radar chart | `DashboardPage.tsx` |
| 37 | Supabase real-time subscription on `user_mastery` | `DashboardPage.tsx` |
| 38 | Interview countdown widget from `profiles.interview_date` | `DashboardPage.tsx` |
| 39 | Call `GET /api/progress` for streak, total solved, avg time | `ProgressPage.tsx` |
| 40 | Call `GET /api/progress/history` for line chart + heatmap | `ProgressPage.tsx` |
| 41 | Decay indicator: flag topics where `last_attempted > 14 days` | `ProgressPage.tsx` |

---

### Phase 6 — Settings (Live)

| # | Task | File(s) |
|---|------|---------|
| 42 | Wire Save → `PUT /api/preferences` in Interview Prep tab | `SettingsPage.tsx` |
| 43 | Wire Save → `PUT /api/preferences` in Preferences tab | `SettingsPage.tsx` |
| 44 | Wire Reset button → `POST /api/progress/reset/:topic_id` | `SettingsPage.tsx` |
| 45 | Show stereotype key + raw mastery table in Your Model tab | `SettingsPage.tsx` |
| 46 | Wire Sign Out → `supabase.auth.signOut()` → redirect `/login` | `SettingsPage.tsx` |
| 47 | Load `email_notifications` from `profiles` on Settings mount | `SettingsPage.tsx` |
| 48 | On notification toggle: direct Supabase `UPDATE profiles SET email_notifications = X` | `SettingsPage.tsx` |

---

### Phase 7 — UI-Only Features (2.1–2.6 from Section 2)

These tasks cover the 6 features that exist in the UI design but were not in the original architecture. Each is now fully accounted for in the Supabase schema — this phase wires them to real data.

#### 7A — Profile Page (`/profile`)

Data sources: `supabase.rpc('get_profile_stats')` + direct reads on `profiles`, `submissions`, `milestones`.

| # | Task | File(s) |
|---|------|---------|
| 49 | Add `/profile` to routes (already in UI, just not in original arch plan) | `routes.tsx` |
| 50 | On mount: call `supabase.rpc('get_profile_stats', { p_user_id })` | `ProfilePage.tsx` |
| 51 | Display total/easy/medium/hard solved counts from stats RPC | `ProfilePage.tsx` |
| 52 | Display XP + level from stats RPC (already in `profiles`) | `ProfilePage.tsx` |
| 53 | Display current + longest streak from stats RPC | `ProfilePage.tsx` |
| 54 | Fetch `milestones` table + compare against stats to render earned badges | `ProfilePage.tsx` |
| 55 | Fetch 5 most recent `submissions` for activity feed (join `problems` for title) | `ProfilePage.tsx` |
| 56 | Subscribe to `profiles` realtime: XP bar animates on new XP after submission | `ProfilePage.tsx` |

#### 7B — Topic Detail Page (`/topic/:topic`)

Data sources: direct Supabase read on `user_mastery` + `GET /api/problems?topic=:topic`.

| # | Task | File(s) |
|---|------|---------|
| 57 | Add `/topic/:topic` to routes (already in UI, not in arch plan) | `routes.tsx` |
| 58 | On mount: read `user_mastery WHERE topic_id = X` for mastery bars (easy/medium/hard) | `TopicDetailPage.tsx` |
| 59 | Fetch `GET /api/problems?topic=:topic` for filtered problem list | `TopicDetailPage.tsx` |
| 60 | Fetch mastery history for this topic from `GET /api/progress/history?topic=:topic` | `TopicDetailPage.tsx` |
| 61 | Show decay warning if `last_attempted > 14 days` for any difficulty cell | `TopicDetailPage.tsx` |

#### 7C — Simplified Description Toggle

The `simplified_description` column is already in `problems` table. `GET /api/problems/:slug` returns it. Just needs the toggle wired.

| # | Task | File(s) |
|---|------|---------|
| 62 | Wire `isSimplified` toggle to display `problem.simplified_description` when true | `ProblemSolvePage.tsx` |
| 63 | Show toggle as disabled (greyed out) if `simplified_description` is null for a problem | `ProblemSolvePage.tsx` |

#### 7D — Incomplete Session Banner

`localStorage` key: `elitecode_session` → `{ slug, title, language, code, timer_seconds }`.

| # | Task | File(s) |
|---|------|---------|
| 64 | On ProblemsPage mount: check `localStorage.getItem('elitecode_session')` and show banner if present | `ProblemsPage.tsx`, `IncompleteSessionBanner.tsx` |
| 65 | Banner "Continue" link navigates to `/problems/:slug` and restores code/timer/language | `IncompleteSessionBanner.tsx`, `ProblemSolvePage.tsx` |
| 66 | On successful submit: `localStorage.removeItem('elitecode_session')` | `ProblemSolvePage.tsx` |
| 67 | On banner "Discard" click: clear localStorage + hide banner | `IncompleteSessionBanner.tsx` |

#### 7E — XP / Level in Navbar

XP and level are in `profiles`. After every submission the backend calls `award_xp()`. The Navbar listens via realtime.

| # | Task | File(s) |
|---|------|---------|
| 68 | On auth: fetch `profiles.xp` and `profiles.level` into `AuthContext` | `AuthContext.tsx` |
| 69 | Subscribe to `profiles` realtime in `AuthContext`: update XP/level on change | `AuthContext.tsx` |
| 70 | Navbar reads `xp` + `level` from `useAuth()` context, renders bar + badge | `Navbar.tsx` |
| 71 | XP bar animates (Framer Motion) when `xp` value increases via realtime update | `Navbar.tsx` |

---

## Summary

| Category | Count |
|----------|-------|
| Architecture features not yet designed in UI | 10 |
| UI features not in architecture (all kept, plans added) | 6 |
| Data model mismatches to fix before wiring | 4 |
| Supabase tables | 9 (8 core + `milestones`) |
| Supabase triggers + helper functions | 5 (`handle_updated_at`, `handle_new_user`, `award_xp`, `update_streak`, `get_profile_stats`) |
| NeetCode 75 problems to seed | 90 entries across 14 topics |
| Milestone badges to seed | 13 |
| VM services to configure | 3 (Nginx, FastAPI, Podman) |
| Frontend wiring tasks | 71 across 7 phases |
