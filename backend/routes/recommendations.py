import asyncio

from fastapi import APIRouter, Depends, HTTPException

from auth import verify_jwt
from services.recommendations import refresh_for_user

router = APIRouter(tags=["recommendations"])


@router.post("/recommendations/refresh")
async def refresh_recommendations(user: dict = Depends(verify_jwt)):
    user_id = user.get("sub", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    rec = await asyncio.to_thread(refresh_for_user, user_id)
    return {"recommendation": rec}
