"""Test isolation: never touch the real Atlas database or the real JWT secret."""

import os

import mongomock
import pytest

# Test-only values (not secrets). Set before backend modules read the environment.
os.environ["JWT_SECRET"] = "test-only-secret-0123456789abcdef0123456789abcdef"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["COOKIE_SECURE"] = "false"
os.environ["GAZE_WARMUP"] = "0"          # never start OpenFace containers from tests


@pytest.fixture(autouse=True)
def mongo(monkeypatch):
    """Fresh in-memory MongoDB per test, with the production indexes."""
    from backend.core import database
    from backend.routers import auth as auth_router

    client = mongomock.MongoClient()
    db = client["neurosense_test"]
    database.ensure_indexes_on(db)
    monkeypatch.setattr(database, "_client", client)
    monkeypatch.setattr(database, "_db", db)
    auth_router.reset_throttle()
    yield db


CSRF = {"X-Requested-With": "NeuroSense"}


@pytest.fixture()
def app_client():
    """Factory for independent cookie-holding clients (one per simulated user/browser)."""
    from fastapi.testclient import TestClient
    from backend.main import app

    opened = []

    def make():
        c = TestClient(app, headers=CSRF)
        c.__enter__()
        opened.append(c)
        return c

    yield make
    for c in opened:
        c.__exit__(None, None, None)


CHILD_TRAIT_IDS = {1, 5, 7, 10}          # independent copy of the child AQ-10 contract (agree scores on these)
ADULT_TRAIT_IDS = {1, 7, 8, 10}


def answers_scoring(points: int, category: str = "child") -> dict:
    """Valid answers whose server-computed total is exactly ``points`` (first ``points`` items score)."""
    trait = CHILD_TRAIT_IDS if category == "child" else ADULT_TRAIT_IDS
    out = {}
    for i in range(1, 11):
        scores = i <= points
        agree = (i in trait) == scores              # agree scores on trait items; disagree scores on the rest
        out[f"A{i}"] = "Definitely agree" if agree else "Definitely disagree"
    return out


def screening_body(points: int = 8, category: str = "child", age: int = 8, **extra):
    body = {
        "category": category,
        "demo": {"subjectName": "T", "respondentName": "P", "respondentRelationship": "Parent",
                 "age": age, "gender": "Male", "jaundice": "No", "familyAsd": "No"},
        "answers": answers_scoring(points, category),
        "gazeSkipped": True, "speechSkipped": True, "facialSkipped": True,
    }
    body.update(extra)
    return body
