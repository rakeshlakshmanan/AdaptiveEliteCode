from datetime import date, timedelta

from config import (BACKGROUND_TOPIC_MODIFIERS, P_GUESS, P_GUESS_HINTED,
                    P_SLIP, P_TRANSIT, STEREOTYPE_BASE_PRIORS,
                    STEREOTYPE_DEFAULT_PRIOR, TIME_SLIP_RATE,
                    TIME_SLIP_THRESHOLD, XP_REWARDS, db)


def bkt_update(p_learned: float, correct: bool, hinted: bool = False) -> float:
    """BKT step with optional hint penalty.

    When *hinted* is True and the answer is correct, we substitute the
    inflated P_GUESS_HINTED for P_GUESS.  This models the fact that a
    hint-assisted correct answer is weaker evidence of genuine mastery.
    """
    p_g = P_GUESS_HINTED if (correct and hinted) else P_GUESS
    if correct:
        denom = p_learned * (1 - P_SLIP) + (1 - p_learned) * p_g
        posterior = (p_learned * (1 - P_SLIP)) / denom if denom else p_learned
    else:
        denom = p_learned * P_SLIP + (1 - p_learned) * (1 - p_g)
        posterior = (p_learned * P_SLIP) / denom if denom else p_learned

    return posterior + (1 - posterior) * P_TRANSIT


def _time_slip_adjustment(problem_id: int, time_spent: int) -> float:
    """Return an additional P(Slip) penalty for unusually slow correct solves.

    Fetches the median solve time for *problem_id* across all passing
    submissions.  If the user took more than TIME_SLIP_THRESHOLD × median,
    a small extra slip is added to the BKT update, reducing the mastery gain.
    Penalty is capped at 0.15 to avoid over-penalising.
    """
    if not time_spent:
        return 0.0
    res = (
        db.from_("submissions")
        .select("time_spent_seconds")
        .eq("problem_id", problem_id)
        .eq("passed", True)
        .limit(100)
        .execute()
    )
    times = [
        r["time_spent_seconds"]
        for r in (res.data or [])
        if r.get("time_spent_seconds")
    ]
    if not times:
        return 0.0
    median_t = sorted(times)[len(times) // 2]
    if median_t <= 0:
        return 0.0
    ratio = time_spent / median_t
    return min(0.15, max(0.0, (ratio - TIME_SLIP_THRESHOLD) * TIME_SLIP_RATE))


def update_mastery(
    user_id: str,
    topic_id: int,
    difficulty: str,
    passed: bool,
    hint_used: bool = False,
    time_spent: int = 0,
    problem_id: int = 0,
) -> tuple[int, int]:
    existing = (
        db.from_("user_mastery")
        .select("p_learned, attempts, correct_count")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id)
        .eq("difficulty", difficulty)
        .limit(1)
        .execute()
    )
    row = (existing.data or [None])[0] or {}
    p_before = float(row.get("p_learned", 0.0))

    # Time-on-task: raise effective slip if solve was unusually slow
    extra_slip = _time_slip_adjustment(problem_id, time_spent) if passed else 0.0
    effective_p_slip = min(P_SLIP + extra_slip, 0.4)

    # Hint-penalised BKT: use inflated P_GUESS when hint was used
    p_g = P_GUESS_HINTED if (passed and hint_used) else P_GUESS
    if passed:
        denom = p_before * (1 - effective_p_slip) + (1 - p_before) * p_g
        posterior = (p_before * (1 - effective_p_slip)) / denom if denom else p_before
    else:
        denom = p_before * effective_p_slip + (1 - p_before) * (1 - p_g)
        posterior = (p_before * effective_p_slip) / denom if denom else p_before
    p_after = posterior + (1 - posterior) * P_TRANSIT

    db.from_("user_mastery").upsert(
        {
            "user_id": user_id,
            "topic_id": topic_id,
            "difficulty": difficulty,
            "p_learned": round(p_after, 6),
            "attempts": (row.get("attempts") or 0) + 1,
            "correct_count": (row.get("correct_count") or 0) + (1 if passed else 0),
        },
        on_conflict="user_id,topic_id,difficulty",
    ).execute()

    return round(p_before * 100), round(p_after * 100)


def award_xp(user_id: str, difficulty: str) -> int:
    xp = XP_REWARDS.get(difficulty, 50)
    res = db.from_("profiles").select("xp, level").eq("id", user_id).single().execute()
    if res.data:
        new_xp = (res.data.get("xp") or 0) + xp
        new_level = max(1, new_xp // 500 + 1)
        db.from_("profiles").update({"xp": new_xp, "level": new_level}).eq(
            "id", user_id
        ).execute()
    return xp


def update_streak(user_id: str) -> None:
    today = date.today()
    res = (
        db.from_("streaks")
        .select("current_streak, longest_streak, last_active_date")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [])[0] if res.data else None
    if row:
        last_str = row.get("last_active_date")
        current = row.get("current_streak", 0)
        longest = row.get("longest_streak", 0)
        if last_str:
            last = date.fromisoformat(str(last_str))
            if last == today:
                return
            elif last == today - timedelta(days=1):
                current += 1
            else:
                current = 1
        else:
            current = 1
        db.from_("streaks").update(
            {
                "current_streak": current,
                "longest_streak": max(longest, current),
                "last_active_date": str(today),
            }
        ).eq("user_id", user_id).execute()
    else:
        db.from_("streaks").insert(
            {
                "user_id": user_id,
                "current_streak": 1,
                "longest_streak": 1,
                "last_active_date": str(today),
            }
        ).execute()


def initialize_stereotype_priors(
    user_id: str, experience_level: str, prior_platform_exp: str, background: str = ""
) -> None:
    base_prior = STEREOTYPE_BASE_PRIORS.get(
        (experience_level, prior_platform_exp), STEREOTYPE_DEFAULT_PRIOR
    )
    topic_modifiers = BACKGROUND_TOPIC_MODIFIERS.get(background, {})
    topics = db.from_("topics").select("id, name").execute().data or []
    rows = [
        {
            "user_id": user_id,
            "topic_id": topic["id"],
            "difficulty": diff,
            "p_learned": min(1.0, base_prior + topic_modifiers.get(topic["name"], 0.0)),
        }
        for topic in topics
        for diff in ("easy", "medium", "hard")
    ]
    if rows:
        db.from_("user_mastery").upsert(
            rows,
            on_conflict="user_id,topic_id,difficulty",
            ignore_duplicates=True,
        ).execute()


def snapshot_mastery(user_id: str) -> None:
    rows = db.from_("user_mastery").select("p_learned").eq("user_id", user_id).execute()
    vals = [r["p_learned"] for r in (rows.data or []) if r.get("p_learned") is not None]
    if not vals:
        return
    overall = round(sum(vals) / len(vals) * 100, 2)
    db.from_("mastery_snapshots").upsert(
        {
            "user_id": user_id,
            "snapshot_date": str(date.today()),
            "overall_mastery": overall,
        },
        on_conflict="user_id,snapshot_date",
    ).execute()
