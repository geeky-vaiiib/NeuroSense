"""Password hashing (Argon2id) and JWT access tokens. The backend is the only issuer/verifier."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

try:
    from .config import get_settings
except ImportError:  # pragma: no cover
    from core.config import get_settings

_hasher = PasswordHasher()   # argon2-cffi defaults to Argon2id
# Verified against when the email is unknown so login timing does not reveal account existence.
_DUMMY_HASH = _hasher.hash("timing-equalisation-not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def create_access_token(user_id: str, email: str, role: str) -> tuple[str, str, datetime]:
    """Returns (jwt, jti, expires_at). Claims are limited to identity + expiry metadata."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=s.access_token_expire_minutes)
    jti = uuid.uuid4().hex
    token = jwt.encode(
        {
            "sub": user_id, "email": email, "role": role,
            "iat": now, "exp": exp, "nbf": now,
            "iss": s.jwt_issuer, "aud": s.jwt_audience, "jti": jti,
        },
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )
    return token, jti, exp


def decode_access_token(token: str) -> dict:
    """Verify signature, expiry, issuer, audience and required claims. Raises jwt.PyJWTError."""
    s = get_settings()
    return jwt.decode(
        token,
        s.jwt_secret,
        algorithms=[s.jwt_algorithm],          # explicit: never trust the token's own alg header
        audience=s.jwt_audience,
        issuer=s.jwt_issuer,
        options={"require": ["exp", "iat", "sub", "jti", "iss", "aud"]},
    )
