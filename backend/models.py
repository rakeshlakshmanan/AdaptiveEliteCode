from dataclasses import dataclass, asdict

from pydantic import BaseModel


class ExecuteRequest(BaseModel):
    code:               str
    language:           str
    problem_id:         int
    run_only:           bool = False
    time_spent_seconds: int  = 0
    hint_used:          bool = False   # True if user viewed a hint before submitting


@dataclass
class SubmissionResult:
    passed:            bool
    results:           list[dict]
    execution_time_ms: int
    mastery_before:    int = 0
    mastery_after:     int = 0
    mastery_gain:      int = 0
    xp_gained:         int = 0
    topic_ids:         list[int] | None = None

    def to_response(self) -> dict:
        d = asdict(self)
        d.pop("topic_ids")
        return d


class ProblemNotFound(Exception):
    pass


class NoTestCases(Exception):
    pass


class ExecutionUnavailable(Exception):
    pass
