from fastapi import APIRouter

from config import JUDGE0_URL

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "judge0": JUDGE0_URL}
