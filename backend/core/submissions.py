"""Atomic case persistence for retries. The response and case share one document.

Concurrent computations may run, but the unique owner/key index admits one case.
No pending reservation can strand a key after a process crash. Keys have no TTL:
replay returns the original result, including its original scoring version.
"""
from __future__ import annotations

from pymongo.errors import DuplicateKeyError
from fastapi import HTTPException

from .database import get_cases_collection
from .cases_store import normalize_case_record


def replay(owner: str, key: str | None, digest: str):
    if not key:
        return None
    doc = get_cases_collection().find_one({"user_id": owner, "idempotency_key": key})
    if doc is None:
        return None
    if doc["request_digest"] != digest:
        raise HTTPException(409, "This submission key was already used for different answers. Start a new submission.")
    return doc["submission_response"]


def save(record: dict, response: dict, key: str | None, digest: str) -> dict:
    doc = normalize_case_record(record)
    if key:
        doc.update(idempotency_key=key, request_digest=digest, submission_response=response)
    try:
        get_cases_collection().insert_one(doc)
    except DuplicateKeyError:
        existing = replay(record["user_id"], key, digest)
        if existing is None:
            raise
        return existing
    return response
