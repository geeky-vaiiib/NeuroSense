"""Operator tool for account roles and legacy-case ownership (run on a trusted machine).

  python3 -m backend.scripts.manage_users legacy-cases
  python3 -m backend.scripts.manage_users assign-legacy-cases --email owner@example.com --yes
  python3 -m backend.scripts.manage_users set-role --email someone@example.com --role clinician

Cases created before authentication have no ``user_id``.  They are invisible to every
account until an operator deliberately assigns them; nothing is assigned automatically.
"""

from __future__ import annotations

import argparse
import sys

from backend.core import database
from backend.core.users_store import ROLES, get_by_email
from backend.schemas.auth import normalize_email


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("legacy-cases", help="count cases with no owner")
    a = sub.add_parser("assign-legacy-cases", help="assign every ownerless case to one account")
    a.add_argument("--email", required=True)
    a.add_argument("--yes", action="store_true", help="actually write (default is a dry run)")
    r = sub.add_parser("set-role", help="change an account's role")
    r.add_argument("--email", required=True)
    r.add_argument("--role", required=True, choices=ROLES)
    args = ap.parse_args(argv)

    database.init_db()
    cases = database.get_cases_collection()
    orphan = {"$or": [{"user_id": {"$exists": False}}, {"user_id": None}]}

    if args.cmd == "legacy-cases":
        print(f"{cases.count_documents(orphan)} case(s) have no owner")
        return 0

    user = get_by_email(normalize_email(args.email))
    if not user:
        print(f"No account with email {args.email}", file=sys.stderr)
        return 1

    if args.cmd == "set-role":
        database.get_users_collection().update_one({"user_id": user["user_id"]}, {"$set": {"role": args.role}})
        print(f"{user['email']} -> role {args.role}")
        return 0

    n = cases.count_documents(orphan)
    if not args.yes:
        print(f"DRY RUN: would assign {n} ownerless case(s) to {user['email']}. Re-run with --yes.")
        return 0
    res = cases.update_many(orphan, {"$set": {"user_id": user["user_id"]}})
    print(f"Assigned {res.modified_count} case(s) to {user['email']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
