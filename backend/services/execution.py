import asyncio

import httpx

from config import (JUDGE0_CPU_LIMIT, JUDGE0_TIMEOUT, JUDGE0_URL,
                    JUDGE0_WALL_LIMIT, LANGUAGE_IDS, STATUS_ACCEPTED)


def _judge0_status_label(status_id: int) -> str:
    if status_id == 3:
        return "Accepted"
    if status_id == 6:
        return "Compilation Error"
    if status_id == 5:
        return "Time Limit Exceeded"
    if status_id in (7, 8, 9, 10, 11, 12):
        return "Runtime Error"
    return "Error"


async def _submit_judge0(
    client: httpx.AsyncClient, code: str, language_id: int, stdin: str
) -> dict:
    resp = await client.post(
        f"http://localhost:2358/submissions",
        params={"wait": "true", "base64_encoded": "false"},
        json={
            "source_code": code,
            "language_id": language_id,
            "stdin": stdin,
            "cpu_time_limit": JUDGE0_CPU_LIMIT,
            "wall_time_limit": JUDGE0_WALL_LIMIT,
        },
        timeout=JUDGE0_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def _apply_harness(harness: str | None, user_code: str) -> str:
    if harness:
        return harness.replace("{USER_CODE}", user_code)
    return f"from typing import *\nimport json, sys\n{user_code}"


def _normalize(s: str) -> str:
    return "".join(s.split())


async def run_all_test_cases(
    code: str, language: str, test_cases: list[dict], harness: str | None = None
) -> list[dict]:
    language_id = LANGUAGE_IDS.get(language, 71)
    full_code = _apply_harness(harness, code)

    async with httpx.AsyncClient() as client:
        judge0_results = await asyncio.gather(
            *[
                _submit_judge0(client, full_code, language_id, tc.get("input", ""))
                for tc in test_cases
            ]
        )

    results = []
    for i, (tc, jr) in enumerate(zip(test_cases, judge0_results)):
        expected = str(tc.get("expected", "")).strip()
        status_id = jr.get("status", {}).get("id", 0)
        stdout = (jr.get("stdout") or "").strip()
        stderr = (jr.get("stderr") or jr.get("compile_output") or "").strip()
        time_ms = int(float(jr.get("time") or 0) * 1000)
        ran_ok = status_id == STATUS_ACCEPTED
        passed = ran_ok and _normalize(stdout) == _normalize(expected)

        results.append(
            {
                "case": i + 1,
                "passed": passed,
                "input": tc.get("input", ""),
                "expected": expected,
                "actual": stdout if ran_ok else "",
                "stderr": stderr,
                "time_ms": time_ms,
                "status": _judge0_status_label(status_id),
            }
        )
    return results
