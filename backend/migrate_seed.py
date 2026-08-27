"""One-shot seed migration script.

Reads the legacy ``cases_db.json`` file and upserts every record into the
MongoDB Atlas ``cases`` collection.  Run this script exactly once after
setting up the Atlas connection.

Usage (from the project root)::

    cd /path/to/neuro-sense-main
    python -m backend.migrate_seed

Or directly from the backend directory::

    cd backend
    python migrate_seed.py

The script is idempotent: re-running it will not create duplicate documents
because the upsert key is the application-level ``id`` field, which has a
unique index in MongoDB.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# ── Load .env before importing database ───────────────────────────────────────
_ENV_PATH = Path(__file__).resolve().parent / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=_ENV_PATH, override=False)
    print(f"[migrate_seed] Loaded environment from {_ENV_PATH}")
except ImportError:
    print(
        "[migrate_seed] WARNING: python-dotenv not installed. "
        "Ensure MONGODB_URI is already in your environment."
    )

# ── Resolve paths ─────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent
_JSON_PATH = _BACKEND_DIR / "cases_db.json"

# Add backend to sys.path so relative imports work when run as a plain script
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# ── Imports ───────────────────────────────────────────────────────────────────
try:
    from core.database import get_cases_collection, init_db
except ImportError:
    from backend.core.database import get_cases_collection, init_db  # type: ignore[no-redef]


def load_json_records(path: Path) -> dict[str, dict]:
    """Load the legacy JSON database file."""
    if not path.exists():
        print(f"[migrate_seed] JSON database not found at {path}. Nothing to migrate.")
        return {}

    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        return {
            item["id"]: item
            for item in payload
            if isinstance(item, dict) and item.get("id")
        }
    return {}


def migrate() -> None:
    """Main migration entry point."""
    print("[migrate_seed] Connecting to MongoDB Atlas...")
    init_db()

    records = load_json_records(_JSON_PATH)
    if not records:
        print("[migrate_seed] No records to migrate. Exiting.")
        return

    col = get_cases_collection()
    total = len(records)
    inserted = 0
    updated = 0
    errors = 0

    print(f"[migrate_seed] Migrating {total} records from {_JSON_PATH}...")

    for case_id, record in records.items():
        # Ensure the id field is consistent
        record.setdefault("id", case_id)
        try:
            result = col.replace_one({"id": record["id"]}, record, upsert=True)
            if result.upserted_id is not None:
                inserted += 1
                print(f"  ✓ Inserted  {record['id']}")
            else:
                updated += 1
                print(f"  ↻ Already present (updated): {record['id']}")
        except Exception as exc:  # noqa: BLE001
            errors += 1
            print(f"  ✗ ERROR for {record.get('id', '?')}: {exc}")

    print(
        f"\n[migrate_seed] Done. "
        f"Inserted: {inserted} | Updated: {updated} | Errors: {errors} | Total: {total}"
    )

    if errors:
        print("[migrate_seed] WARNING: Some records failed to migrate. Check output above.")
        sys.exit(1)
    else:
        print("[migrate_seed] All records migrated successfully ✓")


if __name__ == "__main__":
    migrate()
