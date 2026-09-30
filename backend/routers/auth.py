"""Registration, login, logout and current-user endpoints."""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

try:
    from ..core.auth import CurrentUser, get_current_user
    from ..core.config import get_settings
    from ..core.database import get_revoked_tokens_collection
    from ..core.security import create_access_token, needs_rehash, hash_password, verify_password
    from ..core import users_store
    from ..schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
except ImportError:  # pragma: no cover
    from core.auth import CurrentUser, get_current_user
    from core.config import get_settings
    from core.database import get_revoked_tokens_collection
    from core.security import create_access_token, needs_rehash, hash_password, verify_password
    from core import users_store
    from schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut

logger = logging.getLogger("neurosense.auth")
router = APIRouter(prefix="/auth", tags=["Auth"])

# ── login throttle (in-process; see docs for the single-worker limitation) ───
MAX_FAILURES = 5
WINDOW_S = 15 * 60
_failures: dict[str, deque] = defaultdict(deque)


def _throttle_key(request: Request, email: str) -> str:
    return f"{request.client.host if request.client else '?'}|{email}"


def _check_throttle(key: str) -> None:
    q, now = _failures[key], time.monotonic()
    while q and now - q[0] > WINDOW_S:
        q.popleft()
    if len(q) >= MAX_FAILURES:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")


def reset_throttle() -> None:
    _failures.clear()


def _set_session_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.cookie_name, token,
        max_age=s.access_token_expire_minutes * 60,
        httponly=True, secure=s.cookie_secure, samesite=s.cookie_samesite, path="/",
    )


def _issue_session(response: Response, user: dict) -> None:
    token, _, _ = create_access_token(user["user_id"], user["email"], user["role"])
    _set_session_cookie(response, token)


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest, response: Response):
    """Create an account with the default (least-privileged) role and start a session."""
    try:
        user = users_store.create_user(body.name, body.email, body.password)
    except users_store.DuplicateEmail:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from None
    _issue_session(response, user)
    return {"user": users_store.public_user(user)}


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, request: Request, response: Response):
    key = _throttle_key(request, body.email)
    _check_throttle(key)

    user = users_store.get_by_email(body.email)
    ok = verify_password(body.password, user.get("password_hash") if user else None)
    if not (ok and user and user.get("is_active", False)):
        _failures[key].append(time.monotonic())
        # Same message and status whether the email, password or account state was wrong.
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    _failures.pop(key, None)
    if needs_rehash(user["password_hash"]):
        users_store.set_password_hash(user["user_id"], hash_password(body.password))
    _issue_session(response, user)
    return {"user": users_store.public_user(user)}


@router.post("/logout", status_code=204)
def logout(response: Response, user: CurrentUser = Depends(get_current_user)):
    """Revoke this token server-side (until its natural expiry) and clear the cookie."""
    try:
        get_revoked_tokens_collection().insert_one({
            "jti": user.jti,
            "user_id": user.user_id,
            "expires_at": datetime.fromtimestamp(user.exp, tz=timezone.utc),
        })
    except Exception:  # already revoked
        logger.debug("token already revoked")
    s = get_settings()
    response.delete_cookie(s.cookie_name, path="/", samesite=s.cookie_samesite, secure=s.cookie_secure, httponly=True)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser = Depends(get_current_user)):
    doc = users_store.get_by_id(user.user_id)
    return users_store.public_user(doc)
