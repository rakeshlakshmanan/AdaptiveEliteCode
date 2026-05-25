# Bayesian Knowledge Tracing (BKT) in EliteCode

## What is BKT?

Bayesian Knowledge Tracing is a probabilistic model that estimates the probability
a user has **learned** a skill based on their sequence of correct and incorrect
answers. EliteCode uses BKT to track mastery per topic and difficulty, then uses
that mastery profile to recommend problems in the user's optimal learning zone.

## Parameters

```
P_TRANSIT = 0.3    Probability of learning from a single attempt
P_SLIP    = 0.1    Probability of a wrong answer despite knowing the skill
P_GUESS   = 0.2    Probability of a correct answer despite not knowing the skill
```

These are defined in `config.py` and used across `mastery.py` and `recommendations.py`.


## Stereotype Priors

Rather than starting every user at `p_learned = 0.0`, EliteCode initialises each
user's mastery from a **stereotype prior** derived from their onboarding answers.
This gives the recommendation engine an informed starting point from the very first
problem, rather than treating everyone as a blank slate.

### When it runs

After the onboarding form is saved, the frontend calls `POST /onboarding/init-priors`
(fire-and-forget). The endpoint writes initial `user_mastery` rows for every
topic × difficulty combination. If a row already exists it is left untouched
(`ignore_duplicates=True`), so the operation is safe to retry.

### Base prior: experience × prior platform exposure

The base `p_learned` is looked up from `STEREOTYPE_BASE_PRIORS` in `config.py`
using `(experience_level, prior_platform_exp)` as the key:

```
experience_level    prior_platform_exp    base p_learned
────────────────    ──────────────────    ──────────────
beginner            none                  0.10
beginner            under_50              0.15
beginner            50_to_200             0.20
intermediate        none                  0.20
intermediate        under_50              0.25
intermediate        50_to_200             0.35
intermediate        over_200              0.45
advanced            50_to_200             0.45
advanced            over_200              0.55
```

Any combination not listed defaults to `STEREOTYPE_DEFAULT_PRIOR = 0.10`.

### Topic modifier: background

On top of the base prior, a per-topic delta is applied based on the user's
declared background (`BACKGROUND_TOPIC_MODIFIERS` in `config.py`). The rationale:

- **cs_undergrad** — university courses cover graphs, DP, trees, and binary search
  heavily → +0.05–0.10 on theory-heavy topics.
- **bootcamp** — practical interview prep focuses on arrays, hashing, two pointers,
  sliding window → +0.05–0.10 on those topics.
- **self_taught** — moderate boost across practical topics, similar to bootcamp
  but smaller.
- **career_switch** — minimal modifiers; treated close to beginner regardless of
  declared experience level.

Topics with no modifier for the given background use the base prior unchanged.

### Final p_learned per topic

```
p_learned = min(1.0, base_prior + topic_modifier)
```

### Worked example

Two users both declare `intermediate / 50_to_200`. Their base prior is **0.35**.

**User A — cs_undergrad:**
```
arrays_hashing:       0.35 + 0.05 = 0.40
graphs:               0.35 + 0.10 = 0.45
dynamic_programming:  0.35 + 0.10 = 0.45
sliding_window:       0.35 + 0.00 = 0.35   (no modifier for cs_undergrad)
```

**User B — bootcamp:**
```
arrays_hashing:       0.35 + 0.10 = 0.45
sliding_window:       0.35 + 0.08 = 0.43
graphs:               0.35 + 0.00 = 0.35   (no modifier for bootcamp)
dynamic_programming:  0.35 + 0.00 = 0.35
```

Both users start above zero, but their topic distributions reflect their
backgrounds. The recommendation engine immediately steers them towards
different problems.

Implementation: `mastery.py :: initialize_stereotype_priors()`,
`routes/onboarding.py :: POST /onboarding/init-priors`


## Core Algorithm

Each submission triggers a two-step update to `p_learned`:

**Step 1 — Bayesian posterior update** (did the evidence change our belief?)

```
If correct:
    posterior = p_learned * (1 - P_SLIP) / [p_learned * (1 - P_SLIP) + (1 - p_learned) * P_GUESS]

If incorrect:
    posterior = p_learned * P_SLIP / [p_learned * P_SLIP + (1 - p_learned) * (1 - P_GUESS)]
```

**Step 2 — Learning transit** (the user may have learned from the attempt itself)

```
p_learned_new = posterior + (1 - posterior) * P_TRANSIT
```

Implementation: `mastery.py :: bkt_update()`


## Worked Example

A user with stereotype prior `p_learned = 0.35` on Arrays solves 3 Easy problems
correctly, then gets one wrong:

```
Start (stereotype prior):  p_learned = 0.3500
Attempt 1 (correct):       p_learned = 0.3500  -->  0.7497
Attempt 2 (correct):       p_learned = 0.7497  -->  0.9428
Attempt 3 (correct):       p_learned = 0.9428  -->  0.9875
Attempt 4 (wrong):         p_learned = 0.9875  -->  0.9286
```

Compare this to a user who started at `p_learned = 0.0` (no prior):

```
Attempt 1 (correct):       p_learned = 0.0000  -->  0.3000
Attempt 2 (correct):       p_learned = 0.3000  -->  0.7610
Attempt 3 (correct):       p_learned = 0.7610  -->  0.9543
```

The user with a stereotype prior reaches high mastery faster because the model
started with an informed belief rather than assuming zero knowledge.

A user at p_learned = 0.5 who gets one wrong:

```
Attempt (wrong):      p_learned = 0.5000  -->  0.3778
```


## Submission Flow

When a user submits code via `POST /execute`, this is the full pipeline:

```
                          POST /execute
                               |
                               v
                   +----------------------+
                   |   Run code against   |
                   |   Judge0 test cases  |
                   +----------------------+
                               |
                     all tests passed?
                      /              \
                    yes               no
                    /                   \
                   v                     v
    +-----------------------------+    save submission
    |  Save submission (passed)   |    (passed=false)
    +-----------------------------+
                   |
                   v
    +-----------------------------+
    |  For EACH topic on problem: |
    |    BKT update p_learned     |
    +-----------------------------+
                   |
                   v
    +-----------------------------+
    |  Snapshot daily mastery avg |
    +-----------------------------+
                   |
                   v
    +-----------------------------+
    |  Award XP + update streak   |
    |  (only if all tests passed) |
    +-----------------------------+
                   |
                   v
    +-----------------------------+
    |  Generate recommendation    |
    |  (runs in background)       |
    +-----------------------------+
```


## Multi-Topic Mastery

Problems can have multiple topics (e.g., "Two Sum" has both Arrays and Hash Maps).
On each submission, BKT runs independently for every topic associated with the problem:

```
Problem "Two Sum" (easy) — topics: [Arrays, Hash Maps]
User gets it correct

  Arrays - easy:     p_learned  0.30  -->  0.76
  Hash Maps - easy:  p_learned  0.00  -->  0.30
```

The API response averages the before/after values across all updated topics:

```
mastery_before = avg(30, 0)  = 15%
mastery_after  = avg(76, 30) = 53%
mastery_gain   = +38%
```

Implementation: `routes/execution.py` lines 72-81, calling `mastery.py :: update_mastery()`


## Recommendation Engine

After each submission, EliteCode picks the best next problem using the user's
mastery profile. The goal is to find problems in the **zone of proximal
development** — challenging enough to learn from, but not so hard they'll fail.

### What is the Zone of Proximal Development?

The Zone of Proximal Development (ZPD) is a concept from educational psychology
(Vygotsky, 1978). The core idea: learning happens fastest in the gap between what
you can already do easily and what is currently beyond you. A task you can solve
trivially teaches you nothing; a task you will almost certainly fail also teaches
you nothing. The productive learning zone sits in between.

EliteCode operationalises this as a target P(correct) band of **0.5 – 0.8**:

```
< 0.5   →  probably too hard right now; likely to fail without learning
0.5–0.8 →  the ZPD: challenging but achievable
> 0.8   →  probably too easy; reinforcement value only
```

The ideal centre is **0.65** — a problem the user has roughly a two-thirds chance
of solving. As mastery grows through practice, harder problems enter the ZPD and
easier ones drop out, so recommendations naturally progress without any fixed
curriculum.

### Predicting P(correct)

For each unsolved problem, we estimate how likely the user is to solve it:

```
P(correct) = avg_topic_mastery * difficulty_weight + (1 - difficulty_weight) * P_GUESS
```

Difficulty weights:

```
easy:   0.9    (mastery matters most, high floor)
medium: 0.7
hard:   0.5    (even high mastery only gives ~50% contribution)
```

Example — user with p_learned = 0.70 in Arrays:

```
  Arrays - easy:    0.70 * 0.9 + 0.1 * 0.2 = 0.65
  Arrays - medium:  0.70 * 0.7 + 0.3 * 0.2 = 0.55
  Arrays - hard:    0.70 * 0.5 + 0.5 * 0.2 = 0.45
```

For problems with multiple topics, the mastery is averaged across all topics first.

### Scoring: Zone of Proximal Development

Each candidate problem gets a score. Lower is better:

```
P(correct)
  0.0       0.5        0.65       0.8        1.0
   |---------|==========|##########|==========|---------|
   |  too    |  target  |  ideal   |  target  |  too    |
   |  hard   |  zone    |  center  |  zone    |  easy   |
   |         |          |          |          |         |
   score:    score:     score:     score:     score:
   1.0+dist  0..0.15    0          0..0.15    1.0+dist
```

- **Inside target zone (0.5 - 0.8):** score = distance from center (0.65)
- **Outside target zone:** score = 1.0 + distance from nearest zone edge

Two score adjustments are then applied on top:

- **Company tiebreaker (−0.05):** if the problem is in the ZPD and is tagged with
  one of the user's `target_companies`, its score is reduced slightly so it edges
  out an equally-matched problem with no company relevance.
- **Starting difficulty penalty (+0.2):** if the user chose `starting_difficulty =
  'easy'` in onboarding, medium and hard problems receive a +0.2 penalty. This is
  larger than the entire ZPD range (0–0.15), so easy problems always rank above
  equally-matched harder ones. The penalty does not block harder problems outright —
  as mastery grows and easy problems leave the ZPD, medium/hard problems naturally
  take over.

The problem with the lowest final score wins and gets upserted into the
`recommendations` table.

### Recommendation Reasons

The reason string reflects both where the picked problem fell in the ZPD scoring
and whether it matches the user's target companies. It is shown to the user in
the dashboard.

Problems in the ZPD range (0.5–0.8) that are tagged with one of the user's
`target_companies` receive a score bonus of −0.05, making them edge out
equally-matched problems with no company relevance.

| P(correct) | Company match | reason code        | Displayed as                                               |
|------------|---------------|--------------------|------------------------------------------------------------|
| < 0.5      | —             | `weak_topic`       | "Targets a topic where your mastery is low"                |
| 0.5–0.8    | yes           | `company_priority` | "Matched to your target companies and current skill level" |
| 0.5–0.8    | no            | `zpd_match`        | "Well-matched to your current skill level"                 |
| > 0.8      | —             | `reinforcement`    | "Reinforces a topic you already know well"                 |

Implementation: `recommendations.py :: generate_recommendation()`


## Daily Mastery Snapshots

After mastery updates, the system saves a daily overall mastery percentage:

```
overall_mastery = avg(all p_learned values for user) * 100
```

This is upserted into `mastery_snapshots` keyed by (user_id, snapshot_date),
so only one snapshot per day is kept. The frontend uses this for the
progress-over-time chart.

Implementation: `mastery.py :: snapshot_mastery()`


## Database Tables

| Table              | Key columns                          | Purpose                         |
|--------------------|--------------------------------------|---------------------------------|
| `user_mastery`     | user_id, topic_id, difficulty        | BKT state per skill             |
|                    | p_learned, attempts, correct_count   | Initial values set from stereotype prior |
| `submissions`      | user_id, problem_id, passed          | Full submission history         |
| `recommendations`  | user_id, problem_id, reason          | Current best-next-problem       |
| `mastery_snapshots`| user_id, snapshot_date               | Daily overall mastery %         |
| `problems`         | id, difficulty, test_cases           | Problem definitions             |
| `problem_topics`   | problem_id, topic_id                 | Many-to-many: problems <-> topics |
| `topics`           | id, name, display_name               | Topic catalog (Arrays, etc.)    |
| `profiles`         | id, xp, level, stereotype_key        | User XP, level, onboarding stereotype |
| `streaks`          | user_id, current_streak              | Daily solve streaks             |


## File Map

```
config.py                  P_TRANSIT, P_SLIP, P_GUESS, XP_REWARDS
                           STEREOTYPE_BASE_PRIORS, BACKGROUND_TOPIC_MODIFIERS, STEREOTYPE_DEFAULT_PRIOR
mastery.py                 bkt_update(), update_mastery(), award_xp(), update_streak(), snapshot_mastery()
                           initialize_stereotype_priors()
recommendations.py         _predict_success(), generate_recommendation()
routes/execution.py        POST /execute  — orchestrates the full submission pipeline
routes/onboarding.py       POST /onboarding/init-priors  — initialise BKT priors from stereotype
routes/recommendations.py  POST /recommendations/refresh  — on-demand re-generation
```
