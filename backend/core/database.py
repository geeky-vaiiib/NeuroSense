"""MongoDB Atlas connection module for NeuroSense.

Owns the MongoClient singleton lifecycle.  All other modules obtain the
collection handle via ``get_cases_collection()``.

Environment variables (loaded from backend/.env via python-dotenv):
    MONGODB_URI      — Atlas SRV connection string (required)
    MONGODB_DB_NAME  — database name, defaults to "neurosense"

Usage
-----
Import and call at app startup::

    from .core import database
    database.init_db()   # verifies connectivity, ensures indexes

And at shutdown::

    database.close_db()

During request handling, obtain a collection handle with::

    from .core.database import get_cases_collection
    col = get_cases_collection()
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, OperationFailure
import certifi

logger = logging.getLogger("neurosense.database")

# ── Load .env from backend directory ──────────────────────────────────────────
_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

# ── Module-level singletons (thread-safe in pymongo) ─────────────────────────
_client: MongoClient | None = None
_db: Database | None = None


def _get_uri() -> str:
    """Read MONGODB_URI from environment; raise clearly if missing."""
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        raise RuntimeError(
            "MONGODB_URI environment variable is not set. "
            "Copy backend/.env.example → backend/.env and fill in your Atlas URI."
        )
    return uri


def _get_db_name() -> str:
    """Read MONGODB_DB_NAME from environment, default to 'neurosense'."""
    name = os.environ.get("MONGODB_DB_NAME") or os.environ.get("DATABASE_NAME") or "neurosense"
    return name.strip() or "neurosense"


def _tls_options(uri: str) -> dict:
    """Atlas (mongodb+srv / tls=true) needs the certifi CA bundle; a plain local mongod does not."""
    if uri.startswith("mongodb+srv://") or "tls=true" in uri.lower() or "ssl=true" in uri.lower():
        return {"tlsCAFile": certifi.where()}
    return {}


def init_db() -> None:
    """Initialise the MongoClient singleton and create required indexes.

    Safe to call multiple times — subsequent calls are no-ops if the client
    is already connected.
    """
    global _client, _db  # noqa: PLW0603

    if _client is not None:
        return  # Already initialised

    uri = _get_uri()
    db_name = _get_db_name()

    if uri.startswith("mongomock://"):
        import mongomock
        logger.info("[NeuroSense] Connecting to Mock MongoDB...")
        _client = mongomock.MongoClient()
    else:
        logger.info("[NeuroSense] Connecting to MongoDB Atlas (db=%s)...", db_name)
    
        _client = MongoClient(
            uri,
            # Connection-pool settings appropriate for a single-worker FastAPI process
            maxPoolSize=10,
            minPoolSize=1,
            serverSelectionTimeoutMS=10_000,   # 10 s — fail fast at startup
            connectTimeoutMS=10_000,
            socketTimeoutMS=30_000,
            **_tls_options(uri),
        )
    _db = _client[db_name]

    # Verify connectivity with a cheap command
    try:
        _client.admin.command("ping")
        logger.info("[NeuroSense] MongoDB connection verified ✓")
    except (ConnectionFailure, OperationFailure) as exc:
        _client = None
        _db = None
        raise RuntimeError(
            f"Cannot reach MongoDB Atlas. Check MONGODB_URI in backend/.env. Error: {exc}"
        ) from exc

    # Ensure the unique application-ID index exists
    _ensure_indexes()


def _ensure_indexes() -> None:
    """Create indexes if they do not already exist (cases, users, revoked_tokens)."""
    ensure_indexes_on(get_db())


def ensure_indexes_on(db: Database) -> None:
    col = db["cases"]
    # Unique index on the application-level `id` field (e.g. "NS-A-20260421-AB12")
    col.create_index([("id", ASCENDING)], unique=True, name="idx_case_id_unique")
    # Compound index for the common list-and-filter query pattern
    col.create_index(
        [("category", ASCENDING), ("screening_date", ASCENDING)],
        name="idx_category_screening_date",
    )
    # Index for dashboard aggregation sorts
    col.create_index([("status", ASCENDING)], name="idx_status")
    # Ownership: every list/detail query is scoped by user_id
    col.create_index([("user_id", ASCENDING), ("screening_date", ASCENDING)], name="idx_case_user_id")
    users = db["users"]
    users.create_index([("email", ASCENDING)], unique=True, name="idx_user_email_unique")
    users.create_index([("user_id", ASCENDING)], unique=True, name="idx_user_id_unique")
    # Logged-out tokens are remembered until they would have expired anyway (TTL cleans them up)
    revoked = db["revoked_tokens"]
    revoked.create_index([("jti", ASCENDING)], unique=True, name="idx_revoked_jti_unique")
    revoked.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0, name="idx_revoked_ttl")
    logger.info("[NeuroSense] MongoDB indexes verified ✓")


def close_db() -> None:
    """Close the MongoClient on application shutdown."""
    global _client, _db  # noqa: PLW0603
    if _client is not None:
        _client.close()
        logger.info("[NeuroSense] MongoDB connection closed.")
        _client = None
        _db = None


def get_db() -> Database:
    """Return the active database handle.

    Raises ``RuntimeError`` if ``init_db()`` has not been called.
    """
    if _db is None:
        raise RuntimeError(
            "Database not initialised. Ensure init_db() is called during app startup."
        )
    return _db


def get_users_collection() -> Collection:
    return get_db()["users"]


def get_revoked_tokens_collection() -> Collection:
    return get_db()["revoked_tokens"]


def get_cases_collection() -> Collection:
    """Return the ``cases`` collection from the active database."""
    return get_db()["cases"]
