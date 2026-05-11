import os

from supabase import Client, create_client

JUDGE0_URL = os.environ.get("JUDGE0_URL", "http://localhost:2358")
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://elite-code-frontend.pages.dev")

db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Judge0 language IDs — https://judge0.com/#statuses-and-languages
LANGUAGE_IDS: dict[str, int] = {
    "python": 71,  # Python 3.8.1
    "javascript": 63,  # JavaScript (Node.js 12.14.0)
    "typescript": 74,  # TypeScript 3.7.4
    "java": 62,  # Java (OpenJDK 13.0.1)
    "cpp": 54,  # C++ (GCC 9.2.0)
    "go": 95,  # Go (1.18.5)
}

STATUS_ACCEPTED = 3

JUDGE0_CPU_LIMIT = 5
JUDGE0_WALL_LIMIT = 10
JUDGE0_TIMEOUT = 30.0

XP_REWARDS: dict[str, int] = {
    "easy": 50,
    "medium": 100,
    "hard": 200,
}

P_TRANSIT      = 0.3
P_SLIP         = 0.1
P_GUESS        = 0.2
P_GUESS_HINTED = 0.45   # inflated guess prob when hint used → smaller mastery gain

INTERLEAVE_PENALTY = 0.30   # added to score when topic matches last recommendation

TIME_SLIP_THRESHOLD = 2.0   # ratio of user time / median; penalty starts here
TIME_SLIP_RATE      = 0.05  # extra slip per unit above threshold (capped at 0.15)


STEREOTYPE_BASE_PRIORS: dict[tuple[str, str], float] = {
    ("beginner", "none"): 0.10,
    ("beginner", "under_50"): 0.15,
    ("beginner", "50_to_200"): 0.20,
    ("intermediate", "none"): 0.20,
    ("intermediate", "under_50"): 0.25,
    ("intermediate", "50_to_200"): 0.35,
    ("intermediate", "over_200"): 0.45,
    ("advanced", "50_to_200"): 0.45,
    ("advanced", "over_200"): 0.55,
}
STEREOTYPE_DEFAULT_PRIOR = 0.10

# Per-background topic modifiers: background slug → topic name → delta applied on top of base prior
# CS undergrads: stronger in theory-heavy topics (graphs, DP, trees, binary search)
# Bootcamp grads: stronger in practical interview patterns (arrays, hashing, two pointers, sliding window)
# Self-taught: moderate boost across practical topics
# Career switchers: minimal modifiers — treat as near-beginner regardless of experience
BACKGROUND_TOPIC_MODIFIERS: dict[str, dict[str, float]] = {
    "cs_undergrad": {
        "arrays_hashing":        0.05,
        "binary_search":         0.08,
        "trees":                 0.08,
        "graphs":                0.10,
        "dynamic_programming":   0.10,
        "backtracking":          0.05,
        "heap":                  0.05,
        "tries":                 0.05,
        "bit_manipulation":      0.05,
    },
    "bootcamp": {
        "arrays_hashing":        0.10,
        "two_pointers":          0.08,
        "sliding_window":        0.08,
        "stack":                 0.05,
        "binary_search":         0.03,
        "heap":                  0.02,
    },
    "self_taught": {
        "arrays_hashing":        0.08,
        "two_pointers":          0.05,
        "sliding_window":        0.05,
        "stack":                 0.03,
        "binary_search":         0.03,
        "dynamic_programming":   0.02,
    },
    "career_switch": {
        "arrays_hashing":        0.05,
        "two_pointers":          0.03,
        "sliding_window":        0.03,
    },
}
