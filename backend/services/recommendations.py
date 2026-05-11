from config import INTERLEAVE_PENALTY, P_GUESS, db

_TARGET_P_LOW = 0.5
_TARGET_P_HIGH = 0.8
_TARGET_CENTER = (_TARGET_P_LOW + _TARGET_P_HIGH) / 2

_DIFFICULTY_WEIGHT: dict[str, float] = {
    "easy": 0.9,
    "medium": 0.7,
    "hard": 0.5,
}


def _predict_success(
    mastery_by_topic: dict[int, dict[str, float]],
    topic_ids: list[int],
    difficulty: str,
) -> float:
    if not topic_ids:
        return 0.0

    weight = _DIFFICULTY_WEIGHT.get(difficulty, 0.7)
    p_values = [mastery_by_topic.get(tid, {}).get(difficulty, 0.0) for tid in topic_ids]
    avg_mastery = sum(p_values) / len(p_values)
    return avg_mastery * weight + (1 - weight) * P_GUESS


def generate_recommendation(user_id: str) -> None:
    mastery_rows = (
        db.from_("user_mastery")
        .select("topic_id, difficulty, p_learned")
        .eq("user_id", user_id)
        .execute()
    ).data or []

    mastery_by_topic: dict[int, dict[str, float]] = {}
    for r in mastery_rows:
        tid = r["topic_id"]
        if tid not in mastery_by_topic:
            mastery_by_topic[tid] = {}
        mastery_by_topic[tid][r["difficulty"]] = float(r["p_learned"])

    solved_rows = (
        db.from_("submissions")
        .select("problem_id")
        .eq("user_id", user_id)
        .eq("passed", True)
        .execute()
    ).data or []
    solved_ids = {r["problem_id"] for r in solved_rows}

    profile_res = (
        db.from_("profiles")
        .select("target_companies, starting_difficulty")
        .eq("id", user_id)
        .single()
        .execute()
    )
    target_companies = set(profile_res.data.get("target_companies") or [])
    starting_difficulty = profile_res.data.get("starting_difficulty") or "easy"

    # ── Interleaving: fetch topic(s) of last recommendation ──────────────────
    last_rec = (
        db.from_("recommendations")
        .select("problems(problem_topics(topic_id))")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data or []
    last_topic_ids: set[int] = set()
    if last_rec:
        prob = last_rec[0].get("problems") or {}
        last_topic_ids = {
            pt["topic_id"]
            for pt in (prob.get("problem_topics") or [])
        }

    problems = (
        db.from_("problems")
        .select("id, title, slug, difficulty, company_tags, problem_topics(topic_id)")
        .execute()
    ).data or []

    candidates: list[tuple[float, dict, float]] = []
    for prob in problems:
        if prob["id"] in solved_ids:
            continue
        topic_ids = [pt["topic_id"] for pt in (prob.get("problem_topics") or [])]
        p_correct = _predict_success(mastery_by_topic, topic_ids, prob["difficulty"])

        if _TARGET_P_LOW <= p_correct <= _TARGET_P_HIGH:
            score = abs(p_correct - _TARGET_CENTER)
            prob_companies = set(prob.get("company_tags") or [])
            if target_companies & prob_companies:
                score -= 0.05  # tiebreaker: prefer company-relevant problems
        else:
            dist = min(abs(p_correct - _TARGET_P_LOW), abs(p_correct - _TARGET_P_HIGH))
            score = 1.0 + dist

        if starting_difficulty == "easy" and prob["difficulty"] in ("medium", "hard"):
            score += 0.2  # soft penalty: respect user's preference to start easy

        # ── Interleave penalty: discourage same topic as last recommendation ──
        topic_ids_set = set(topic_ids)
        if last_topic_ids & topic_ids_set:
            score += INTERLEAVE_PENALTY

        candidates.append((score, prob, p_correct))

    if not candidates:
        return

    candidates.sort(key=lambda c: c[0])
    _, best_prob, best_p = candidates[0]

    prob_companies = set(best_prob.get("company_tags") or [])
    company_match = bool(target_companies & prob_companies)

    if best_p < _TARGET_P_LOW:
        reason = "weak_topic"
    elif best_p > _TARGET_P_HIGH:
        reason = "reinforcement"
    elif company_match:
        reason = "company_priority"
    else:
        reason = "zpd_match"

    db.from_("recommendations").upsert(
        {
            "user_id": user_id,
            "problem_id": best_prob["id"],
            "reason": reason,
        },
        on_conflict="user_id",
    ).execute()


def refresh_for_user(user_id: str) -> dict | None:
    generate_recommendation(user_id)
    rec = (
        db.from_("recommendations")
        .select(
            "reason, problems(id, title, slug, difficulty, problem_topics(topics(name, display_name)))"
        )
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return rec.data[0] if rec.data else None
