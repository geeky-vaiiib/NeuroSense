"""FastAPI authentication dependencies: one place that verifies tokens and resolves the user."""

from __future__ import annotations

from typing import Callable, Optional

import jwt
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel

try:
    from .config import get_settings
    from .database import get_revoked_tokens_collection
    from .security import decode_access_token
    from .users_store import get_by_id
except ImportError:  # pragma: no cover
    from core.config import get_settings
    from core.database import get_revoked_tokens_collection
    from core.security import decode_access_token
    from core.users_store import get_by_id

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "NeuroSense"


class CurrentUser(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    is_active: bool
    jti: str
    exp: int


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _extract_token(request: Request) -> tuple[Optional[str], str]:
    """Bearer header wins (API clients); otherwise the HttpOnly session cookie (browser)."""
    header = request.headers.get("authorization", "")
    if header:
        scheme, _, value = header.partition(" ")
        if scheme.lower() != "bearer" or not value.strip():
            raise _unauthorized()
        return value.strip(), "header"
    cookie = request.cookies.get(get_settings().cookie_name)
    return (cookie, "cookie") if cookie else (None, "none")


def get_current_user(request: Request) -> CurrentUser:
    token, source = _extract_token(request)
    if not token:
        raise _unauthorized()

    # Cookie-authenticated writes need a custom header: cross-site forms cannot send it and
    # cross-origin fetches with it are blocked by the CORS allow-list (CSRF defence in depth).
    if source == "cookie" and request.method not in SAFE_METHODS:
        if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
            raise HTTPException(status_code=403, detail="Missing CSRF header")

    try:
        claims = decode_access_token(token)
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token") from None

    if get_revoked_tokens_collection().find_one({"jti": claims["jti"]}):
        raise _unauthorized("Session has been logged out")

    # Identity/role come from the database, never from client-controlled data.
    doc = get_by_id(claims["sub"])
    if doc is None or not doc.get("is_active", False):
        raise _unauthorized("Account not available")

    return CurrentUser(
        user_id=doc["user_id"], email=doc["email"], name=doc["name"], role=doc["role"],
        is_active=True, jti=claims["jti"], exp=int(claims["exp"]),
    )


def require_roles(*roles: str) -> Callable[[CurrentUser], CurrentUser]:
    """Dependency factory for role-restricted routes: Depends(require_roles('clinician'))."""
    def dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep
