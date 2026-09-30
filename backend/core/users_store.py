"""MongoDB access for the ``users`` collection. Only password *hashes* are stored."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pymongo.errors import DuplicateKeyError

try:
    from .database import get_users_collection
    from .security import hash_password
except ImportError:  # pragma: no cover
    from core.database import get_users_collection
    from core.security import hash_password

ROLES = ("user", "clinician")
DEFAULT_ROLE = "user"


class DuplicateEmail(Exception):
    pass


def public_user(doc: dict[str, Any]) -> dict[str, Any]:
    """Whitelist of fields that may leave the backend (never the hash)."""
    return {
        "user_id": doc["user_id"],
        "name": doc["name"],
        "email": doc["email"],
        "role": doc["role"],
        "is_active": bool(doc.get("is_active", True)),
        "created_at": doc.get("created_at"),
    }


def create_user(name: str, email: str, password: str, role: str = DEFAULT_ROLE) -> dict[str, Any]:
    if role not in ROLES:
        raise ValueError(f"unknown role {role!r}")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": uuid.uuid4().hex,
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "role": role,
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    }
    try:
        get_users_collection().insert_one(dict(doc))
    except DuplicateKeyError as exc:      # enforced by idx_user_email_unique, race-safe
        raise DuplicateEmail(email) from exc
    return doc


def get_by_email(email: str) -> Optional[dict[str, Any]]:
    return get_users_collection().find_one({"email": email}, {"_id": 0})


def get_by_id(user_id: str) -> Optional[dict[str, Any]]:
    return get_users_collection().find_one({"user_id": user_id}, {"_id": 0})


def set_password_hash(user_id: str, new_hash: str) -> None:
    get_users_collection().update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
