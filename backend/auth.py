import httpx
from fastapi import Header, HTTPException
from jose import JWTError, jwk as jose_jwk, jwt

from config import SUPABASE_JWT_SECRET, SUPABASE_URL

_jwks_cache: list[dict] | None = None


def _get_jwks() -> list[dict]:
    global _jwks_cache
    if _jwks_cache is None:
        r = httpx.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=5)
        r.raise_for_status()
        _jwks_cache = r.json().get("keys", [])
    return _jwks_cache


def verify_jwt(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")

    last_error: Exception | None = None

    try:
        for key_data in _get_jwks():
            try:
                public_key = jose_jwk.construct(key_data)
                payload = jwt.decode(
                    token,
                    public_key.to_dict(),
                    algorithms=[key_data.get("alg", "ES256")],
                    audience="authenticated",
                )
                return payload
            except JWTError as e:
                last_error = e
                continue
    except httpx.HTTPError as e:
        last_error = e

    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        except JWTError as e:
            last_error = e

    raise HTTPException(status_code=401, detail="Invalid or expired token")
