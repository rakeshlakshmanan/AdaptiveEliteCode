from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from auth import verify_jwt
from models import ExecuteRequest, ExecutionUnavailable, NoTestCases, ProblemNotFound
from services.recommendations import generate_recommendation
from services.submission import process_submission

router = APIRouter(tags=["execution"])


@router.post("/execute")
async def execute(
    body: ExecuteRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(verify_jwt),
):
    user_id: str = user.get("sub", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    try:
        result = await process_submission(
            user_id=user_id,
            problem_id=body.problem_id,
            code=body.code,
            language=body.language,
            time_spent_seconds=body.time_spent_seconds,
            run_only=body.run_only,
            hint_used=body.hint_used,
        )
    except ProblemNotFound:
        raise HTTPException(status_code=404, detail="Problem not found")
    except NoTestCases:
        raise HTTPException(status_code=422, detail="Problem has no test cases")
    except ExecutionUnavailable:
        raise HTTPException(status_code=503, detail="Code execution engine unavailable")

    if result.topic_ids:
        background_tasks.add_task(generate_recommendation, user_id)

    return result.to_response()
