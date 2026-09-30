"""Security/runtime configuration read from the environment (backend/.env via dotenv).

Nothing here has a usable default for secrets: startup fails with a clear message if
JWT_SECRET is missing, too short, or still the .env.example placeholder.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)

ALLOWED_JWT_ALGORITHMS = ("HS256", "HS384", "HS512")
MIN_JWT_SECRET_LEN = 32
_PLACEHOLDERS = ("change-me", "changeme", "replace", "your-secret", "<")


class ConfigError(RuntimeError):
    """Raised at startup when mandatory security configuration is missing or unsafe."""


@dataclass(frozen=True)
class Settings:
    jwt_secret: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    jwt_issuer: str
    jwt_audience: str
    cookie_name: str
    cookie_secure: bool
    cookie_samesite: str
    cors_origins: tuple[str, ...]


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    return default if raw is None else raw.strip().lower() in ("1", "true", "yes", "on")


def load_settings() -> Settings:
    secret = os.environ.get("JWT_SECRET", "").strip()
    if not secret:
        raise ConfigError(
            "JWT_SECRET is not set. Generate one with "
            "`python3 -c \"import secrets; print(secrets.token_urlsafe(48))\"` and put it in backend/.env."
        )
    if len(secret) < MIN_JWT_SECRET_LEN or any(p in secret.lower() for p in _PLACEHOLDERS):
        raise ConfigError(
            f"JWT_SECRET must be a random value of at least {MIN_JWT_SECRET_LEN} characters "
            "(not the .env.example placeholder)."
        )
    alg = os.environ.get("JWT_ALGORITHM", "HS256").strip().upper()
    if alg not in ALLOWED_JWT_ALGORITHMS:
        raise ConfigError(f"JWT_ALGORITHM must be one of {ALLOWED_JWT_ALGORITHMS}, got {alg!r}.")
    try:
        minutes = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    except ValueError as exc:
        raise ConfigError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be an integer.") from exc
    if not 1 <= minutes <= 24 * 60:
        raise ConfigError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be between 1 and 1440.")

    origins = tuple(
        o.strip().rstrip("/")
        for o in os.environ.get(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://localhost:4173,http://localhost:3000",
        ).split(",")
        if o.strip()
    )
    if not origins or "*" in origins:
        raise ConfigError("CORS_ALLOWED_ORIGINS must list explicit origins (no '*') because cookies are used.")

    samesite = os.environ.get("COOKIE_SAMESITE", "lax").strip().lower()
    if samesite not in ("lax", "strict", "none"):
        raise ConfigError("COOKIE_SAMESITE must be lax, strict or none.")
    secure = _bool("COOKIE_SECURE", False)
    if samesite == "none" and not secure:
        raise ConfigError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true.")

    return Settings(
        jwt_secret=secret,
        jwt_algorithm=alg,
        access_token_expire_minutes=minutes,
        jwt_issuer=os.environ.get("JWT_ISSUER", "neurosense").strip(),
        jwt_audience=os.environ.get("JWT_AUDIENCE", "neurosense-app").strip(),
        cookie_name=os.environ.get("SESSION_COOKIE_NAME", "ns_session").strip(),
        cookie_secure=secure,
        cookie_samesite=samesite,
        cors_origins=origins,
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def reset_settings() -> None:
    """Re-read the environment (tests)."""
    global _settings
    _settings = None
