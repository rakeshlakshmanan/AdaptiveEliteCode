import asyncio

import httpx

from config import db
from models import ExecutionUnavailable, NoTestCases, ProblemNotFound, SubmissionResult
from services.execution import run_all_test_cases
from services.mastery import award_xp, snapshot_mastery, update_mastery, update_streak


async def process_submission(
    user_id: str,
    problem_id: int,
    code: str,
    language: str,
    time_spent_seconds: int,
    run_only: bool,
    hint_used: bool = False,
) -> SubmissionResult:
    prob_res = await asyncio.to_thread(
        lambda: db.from_("problems")
        .select("test_cases, difficulty, harness, problem_topics(topic_id)")
        .eq("id", problem_id)
        .single()
        .execute()
    )
    if not prob_res.data:
        raise ProblemNotFound

    test_cases: list[dict] = prob_res.data.get("test_cases") or []
    difficulty: str        = prob_res.data.get("difficulty", "easy")
    harness: str | None    = prob_res.data.get("harness")
    topic_ids: list[int]   = [
        pt["topic_id"] for pt in (prob_res.data.get("problem_topics") or [])
    ]

    if not test_cases:
        raise NoTestCases

    try:
        results = await run_all_test_cases(code, language, test_cases, harness)
    except httpx.ConnectError:
        raise ExecutionUnavailable

    all_passed = all(r["passed"] for r in results)
    exec_time  = max((r["time_ms"] for r in results), default=0)

    mastery_before = mastery_after = mastery_gain = xp_gained = 0

    if not run_only:
        await asyncio.to_thread(
            lambda: db.from_("submissions").insert(
                {
                    "user_id":            user_id,
                    "problem_id":         problem_id,
                    "passed":             all_passed,
                    "language":           language,
                    "code":               code,
                    "execution_time_ms":  exec_time,
                    "test_results":       results,
                    "time_spent_seconds": time_spent_seconds or None,
                    "hint_used":          hint_used,
                }
            ).execute()
        )

        if topic_ids:
            gains = []
            for tid in topic_ids:
                before, after = await asyncio.to_thread(
                    lambda t=tid: update_mastery(
                        user_id, t, difficulty, all_passed,
                        hint_used=hint_used,
                        time_spent=time_spent_seconds,
                        problem_id=problem_id,
                    )
                )
                gains.append((before, after))
            mastery_before = round(sum(g[0] for g in gains) / len(gains))
            mastery_after  = round(sum(g[1] for g in gains) / len(gains))
            mastery_gain   = mastery_after - mastery_before
            await asyncio.to_thread(snapshot_mastery, user_id)

        if all_passed:
            xp_gained = await asyncio.to_thread(award_xp, user_id, difficulty)
            await asyncio.to_thread(update_streak, user_id)

    return SubmissionResult(
        passed=all_passed,
        results=results,
        execution_time_ms=exec_time,
        mastery_before=mastery_before,
        mastery_after=mastery_after,
        mastery_gain=mastery_gain,
        xp_gained=xp_gained,
        topic_ids=topic_ids if not run_only else None,
    )
