"""Authentication, authorization and case-ownership tests (in-memory MongoDB)."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from backend.core import config as cfg
from backend.core.auth import CurrentUser, get_current_user, require_roles
from backend.core.config import ConfigError, load_settings
from backend.core.security import create_access_token, hash_password, verify_password
from backend.main import app
from backend.tests.conftest import CSRF, screening_body

PW = "correct-horse-9"


def register(client, email="a@example.com", name="Alice", password=PW):
    return client.post("/auth/register", json={"name": name, "email": email, "password": password})


def login(client, email="a@example.com", password=PW):
    return client.post("/auth/login", json={"email": email, "password": password})


# ── register / login / me ────────────────────────────────────────────────────

def test_register_returns_safe_user_and_hashes_password(app_client, mongo):
    c = app_client()
    r = register(c, email="  Alice@Example.COM ")
    assert r.status_code == 201
    user = r.json()["user"]
    assert user["email"] == "alice@example.com" and user["role"] == "user" and user["is_active"]
    assert "password" not in r.text and "password_hash" not in r.text and "argon2" not in r.text
    set_cookie = r.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "samesite=lax" in set_cookie
    doc = mongo["users"].find_one({"email": "alice@example.com"})
    assert doc["password_hash"].startswith("$argon2id$")
    assert PW not in str(doc)
    assert verify_password(PW, doc["password_hash"]) and not verify_password("wrong", doc["password_hash"])


@pytest.mark.parametrize("body", [
    {"name": "A", "email": "a@example.com", "password": PW, "role": "clinician"},   # role from client
    {"name": "A", "email": "not-an-email", "password": PW},
    {"name": "A", "email": "a@example.com", "password": "short1"},
    {"name": "A", "email": "a@example.com", "password": "lettersonlylong"},
    {"name": "  ", "email": "a@example.com", "password": PW},
    {"email": "a@example.com", "password": PW},
])
def test_register_validation(app_client, body):
    assert app_client().post("/auth/register", json=body).status_code == 422


def test_duplicate_email_rejected_case_insensitively(app_client, mongo):
    c = app_client()
    assert register(c).status_code == 201
    r = register(app_client(), email="A@EXAMPLE.com")
    assert r.status_code == 409 and "password" not in r.text
    assert mongo["users"].count_documents({}) == 1
    assert "idx_user_email_unique" in mongo["users"].index_information()


def test_login_me_flow(app_client):
    reg = app_client(); register(reg)
    c = app_client()
    assert c.get("/auth/me").status_code == 401
    r = login(c)
    assert r.status_code == 200 and r.json()["user"]["email"] == "a@example.com"
    me = c.get("/auth/me")
    assert me.status_code == 200 and set(me.json()) == {"user_id", "name", "email", "role", "is_active", "created_at"}


def test_bad_credentials_are_indistinguishable(app_client):
    register(app_client())
    c = app_client()
    wrong_pw = login(c, password="not-the-password-1")
    no_user = login(c, email="ghost@example.com")
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()
    assert "set-cookie" not in wrong_pw.headers


def test_inactive_account_cannot_login_or_use_token(app_client, mongo):
    c = app_client(); register(c)
    assert c.get("/auth/me").status_code == 200
    mongo["users"].update_one({"email": "a@example.com"}, {"$set": {"is_active": False}})
    assert c.get("/auth/me").status_code == 401           # existing session dies
    assert login(app_client()).status_code == 401           # and new logins fail


def test_login_throttle(app_client):
    register(app_client())
    c = app_client()
    codes = [login(c, password="wrong-password-1").status_code for _ in range(6)]
    assert codes[:5] == [401] * 5 and codes[5] == 429
    assert login(c).status_code == 429                       # even the right password is blocked


# ── every protected route rejects anonymous callers ─────────────────────────

PUBLIC = {("GET", "/"), ("POST", "/auth/register"), ("POST", "/auth/login"),
          ("GET", "/docs"), ("GET", "/redoc"), ("GET", "/openapi.json"),
          ("GET", "/docs/oauth2-redirect")}


def _routes():
    out = []
    for r in app.routes:
        for m in getattr(r, "methods", None) or []:
            if m in ("HEAD", "OPTIONS"):
                continue
            path = r.path.replace("{case_id}", "NS-X-1")
            if (m, path) not in PUBLIC:
                out.append((m, path))
    return out


def test_route_inventory_is_covered():
    assert len(_routes()) >= 8      # cases(3) + explain + screening + gaze(2) + auth(2)


@pytest.mark.parametrize("method,path", _routes())
def test_protected_routes_reject_anonymous(app_client, method, path):
    c = app_client()
    r = c.request(method, path, json={} if method != "GET" else None)
    assert r.status_code == 401, (method, path, r.status_code)


# ── token attacks ────────────────────────────────────────────────────────────

def _user_and_token(app_client):
    c = app_client(); user = register(c).json()["user"]
    tok, _, _ = create_access_token(user["user_id"], user["email"], user["role"])
    return user, tok


def _bearer(t):
    return {"Authorization": f"Bearer {t}"}


def test_valid_bearer_token_accepted(app_client):
    _, tok = _user_and_token(app_client)
    assert TestClient(app).get("/auth/me", headers=_bearer(tok)).status_code == 200


def _claims(user, **over):
    s = cfg.get_settings()
    now = datetime.now(timezone.utc)
    c = {"sub": user["user_id"], "email": user["email"], "role": "clinician", "iat": now,
         "exp": now + timedelta(minutes=5), "iss": s.jwt_issuer, "aud": s.jwt_audience, "jti": "j1"}
    c.update(over)
    return c


@pytest.mark.parametrize("make", [
    lambda u, t: "garbage",
    lambda u, t: "ns_k3j2h4_1700000000000",                                   # browser-style fake token
    lambda u, t: t[:-4] + ("AAAA" if not t.endswith("AAAA") else "BBBB"),      # modified signature
    lambda u, t: jwt.encode(_claims(u), "some-other-secret-0123456789abcdef0123", algorithm="HS256"),
    lambda u, t: jwt.encode(_claims(u, exp=datetime.now(timezone.utc) - timedelta(minutes=1)),
                            cfg.get_settings().jwt_secret, algorithm="HS256"),   # expired
    lambda u, t: jwt.encode(_claims(u, iss="evil"), cfg.get_settings().jwt_secret, algorithm="HS256"),
    lambda u, t: jwt.encode(_claims(u, aud="other"), cfg.get_settings().jwt_secret, algorithm="HS256"),
    lambda u, t: jwt.encode({k: v for k, v in _claims(u).items() if k != "jti"},
                            cfg.get_settings().jwt_secret, algorithm="HS256"),
    lambda u, t: jwt.encode(_claims(u), None, algorithm="none"),                # alg=none
    lambda u, t: jwt.encode(_claims(u, sub="nonexistent-user"), cfg.get_settings().jwt_secret, algorithm="HS256"),
])
def test_bad_tokens_rejected(app_client, make):
    user, tok = _user_and_token(app_client)
    bad = make(user, tok)
    plain = TestClient(app)
    assert plain.get("/auth/me", headers=_bearer(bad)).status_code == 401
    assert plain.get("/cases/", headers=_bearer(bad)).status_code == 401
    assert plain.get("/cases/", cookies={cfg.get_settings().cookie_name: bad}).status_code == 401


def test_token_claims_are_minimal(app_client):
    user, tok = _user_and_token(app_client)
    claims = jwt.decode(tok, options={"verify_signature": False})
    assert set(claims) == {"sub", "email", "role", "iat", "nbf", "exp", "iss", "aud", "jti"}


def test_role_in_token_is_ignored_in_favour_of_database(app_client):
    user, _ = _user_and_token(app_client)
    forged = jwt.encode(_claims(user, role="clinician"), cfg.get_settings().jwt_secret, algorithm="HS256")
    assert TestClient(app).get("/auth/me", headers=_bearer(forged)).json()["role"] == "user"


def test_cookie_writes_require_csrf_header(app_client):
    c = app_client(); register(c)
    plain = TestClient(app, cookies=c.cookies)               # same session cookie, no CSRF header
    assert plain.post("/screening/screen", json=screening_body()).status_code == 403
    assert plain.get("/cases/").status_code == 200


def test_logout_revokes_token_server_side(app_client):
    c = app_client(); user = register(c).json()["user"]
    tok = c.cookies.get(cfg.get_settings().cookie_name)
    assert TestClient(app).get("/auth/me", headers=_bearer(tok)).status_code == 200
    assert c.post("/auth/logout").status_code == 204
    assert TestClient(app).get("/auth/me", headers=_bearer(tok)).status_code == 401   # stolen copy is dead
    assert c.get("/auth/me").status_code == 401


# ── authorization: case ownership ───────────────────────────────────────────

def _two_users(app_client):
    a, b = app_client(), app_client()
    register(a, "a@example.com", "Alice"); register(b, "b@example.com", "Bob")
    return a, b


def test_user_cannot_read_other_users_case(app_client):
    a, b = _two_users(app_client)
    case_id = a.post("/screening/screen", json=screening_body()).json()["caseId"]

    assert a.get(f"/cases/{case_id}").status_code == 200
    r = b.get(f"/cases/{case_id}")
    assert r.status_code == 404
    assert case_id not in r.text and "subject" not in r.text.lower()
    assert b.get(f"/cases/{case_id}").json() == b.get("/cases/NS-DOES-NOT-EXIST").json()   # no existence oracle


def test_list_and_dashboard_are_scoped_in_the_query(app_client):
    a, b = _two_users(app_client)
    ids = [a.post("/screening/screen", json=screening_body()).json()["caseId"] for _ in range(2)]
    b_id = b.post("/screening/screen", json=screening_body()).json()["caseId"]

    assert {c["id"] for c in a.get("/cases/").json()} == set(ids)
    assert [c["id"] for c in b.get("/cases/").json()] == [b_id]
    assert a.get("/cases/dashboard/summary").json()["totals"]["totalCases"] == 2
    assert b.get("/cases/dashboard/summary").json()["totals"]["totalCases"] == 1


def test_client_supplied_user_id_is_ignored(app_client, mongo):
    a, b = _two_users(app_client)
    b_user = b.get("/auth/me").json()
    a_user = a.get("/auth/me").json()
    body = screening_body(user_id=b_user["user_id"], userId=b_user["user_id"])
    case_id = a.post("/screening/screen", json=body).json()["caseId"]
    assert mongo["cases"].find_one({"id": case_id})["user_id"] == a_user["user_id"]
    assert b.get(f"/cases/{case_id}").status_code == 404


def test_explain_is_authorised_before_any_model_work(app_client):
    a, b = _two_users(app_client)
    case_id = a.post("/screening/screen", json=screening_body()).json()["caseId"]
    assert a.get(f"/explain/{case_id}").status_code == 200
    r = b.get(f"/explain/{case_id}")
    assert r.status_code == 404 and "shap" not in r.text.lower()


def test_legacy_cases_without_owner_are_invisible(app_client, mongo):
    a, _ = _two_users(app_client)
    mongo["cases"].insert_one({"id": "NS-LEGACY-1", "category": "child", "age": 8})
    assert a.get("/cases/").json() == []
    assert a.get("/cases/NS-LEGACY-1").status_code == 404


def test_case_store_refuses_unscoped_access():
    from backend.core import cases_store
    with pytest.raises(ValueError):
        cases_store.list_case_records("")
    with pytest.raises(ValueError):
        cases_store.get_case_record("NS-X", None)
    with pytest.raises(ValueError):
        cases_store.upsert_case_record({"id": "NS-X"})


def test_gaze_routes_require_auth_but_work_when_authenticated(app_client):
    c = app_client()
    assert c.get("/gaze/status").status_code == 401
    register(c)
    assert c.get("/gaze/status").status_code == 200


# ── role dependency ──────────────────────────────────────────────────────────

def test_require_roles(app_client):
    mini = FastAPI()

    @mini.get("/only-clinician")
    def only(user: CurrentUser = Depends(require_roles("clinician"))):
        return {"ok": user.role}

    c = app_client(); user = register(c).json()["user"]
    tok = c.cookies.get(cfg.get_settings().cookie_name)
    mc = TestClient(mini)
    assert mc.get("/only-clinician", headers=_bearer(tok)).status_code == 403     # role 'user'
    from backend.core.database import get_users_collection
    get_users_collection().update_one({"user_id": user["user_id"]}, {"$set": {"role": "clinician"}})
    assert mc.get("/only-clinician", headers=_bearer(tok)).json() == {"ok": "clinician"}


# ── configuration ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("env,msg", [
    ({"JWT_SECRET": ""}, "JWT_SECRET is not set"),
    ({"JWT_SECRET": "short"}, "at least 32"),
    ({"JWT_SECRET": "change-me-change-me-change-me-change-me-xx"}, "placeholder"),
    ({"JWT_ALGORITHM": "none"}, "JWT_ALGORITHM"),
    ({"CORS_ALLOWED_ORIGINS": "*"}, "no '*'"),
    ({"JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "abc"}, "integer"),
    ({"COOKIE_SAMESITE": "none", "COOKIE_SECURE": "false"}, "COOKIE_SECURE"),
])
def test_startup_config_fails_clearly(monkeypatch, env, msg):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    with pytest.raises(ConfigError, match=msg):
        load_settings()


def test_missing_model_is_503_not_a_fabricated_probability(app_client, monkeypatch):
    import backend.routers.screening as scr
    monkeypatch.setattr(scr, "predict", lambda *a, **k: {
        "probability": 0.9, "risk_level": "High", "prediction": 1, "mock": True, "model_used": "mock"})
    monkeypatch.delenv("NEUROSENSE_ALLOW_MOCK_INFERENCE", raising=False)
    c = app_client(); register(c)
    r = c.post("/screening/screen", json=screening_body())
    assert r.status_code == 503
    assert c.get("/cases/").json() == []            # nothing was stored
