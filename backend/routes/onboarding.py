import asyncio

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import verify_jwt
from services.mastery import initialize_stereotype_priors

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class InitPriorsRequest(BaseModel):
    experience_level: str
    prior_platform_exp: str
    background: str = ""


@router.post("/init-priors", status_code=204)
async def init_priors(body: InitPriorsRequest, user_id: str = Depends(verify_jwt)):
    await asyncio.to_thread(
        initialize_stereotype_priors,
        user_id,
        body.experience_level,
        body.prior_platform_exp,
        body.background,
    )
