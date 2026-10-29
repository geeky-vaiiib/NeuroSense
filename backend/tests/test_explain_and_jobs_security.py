"""Explainability honesty, gaze job lifecycle, and extra security checks."""

import time

import numpy as np
import pytest

from backend.ml.gaze import jobs
from backend.ml.preprocessor import feature_names_for, preprocess_for_inference
from backend.tests.conftest import screening_body

PW = "correct-horse-9"


def _login(c, email="x@example.com"):
    return c.post("/auth/register", json={"name": "X", "email": email, "password": PW})


# ── explainability ──────────────────────────────────────────────────────────

def test_feature_names_match_the_model_input_order():
    demo = {"age": 8, "gender": "Male", "jaundice": "Yes", "familyAsd": "No", "ethnicity": "Other"}
    from backend.tests.conftest import answers_scoring
    for cat in ("child", "adult"):
        X = preprocess_for_inference(demo, answers_scoring(5, cat), None, category=cat)
        names = feature_names_for(cat)
        assert X.shape[1] == len(names) == 15
        assert names[10:] == ["Age", "Gender", "Ethnicity", "Jaundice", "Family_ASD"]       # training column order
        assert X[0, names.index("Jaundice")] == 1 and X[0, names.index("Family_ASD")] == 0 and X[0, names.index("Age")] == 8


def test_explain_separates_score_explanation_from_model_explanation(app_client):
    c = app_client(); _login(c)
    d = c.post("/screening/screen", json=screening_body(points=7)).json()
    r = c.get(f"/explain/{d['caseId']}")
    assert r.status_code == 200
    e = r.json()
    assert e["scoreExplanation"]["total_score"] == 7 and len(e["scoreExplanation"]["items"]) == 10
    me = e["modelExplanation"]
    assert me["available"] is True and "not the result" in me["scope"] and "gaze" in me["scope"]
    assert e["shap"] and e["lime"] and len(e["shap"]) <= 8
    assert e["isMock"] is False


def test_explain_is_unavailable_not_fabricated_when_no_model(app_client):
    c = app_client(); _login(c)
    d = c.post("/screening/screen", json=screening_body(points=7)).json()
    c.app.state.model_registry = {}            # simulate a server with no questionnaire models
    e = c.get(f"/explain/{d['caseId']}").json()
    assert e["modelExplanation"]["available"] is False and "No questionnaire ML model" in e["modelExplanation"]["reason"]
    assert e["shap"] == [] and e["lime"] == [] and e["scoreExplanation"]["total_score"] == 7


def test_shap_and_lime_engines_return_none_instead_of_mock_values():
    from backend.ml.lime_engine import compute_lime
    from backend.ml.shap_engine import compute_shap
    X = np.zeros((1, 15))
    assert compute_shap(None, X, feature_names_for("child")) is None
    assert compute_lime(None, X, None, feature_names_for("child")) is None


def test_explain_requires_ownership(app_client):
    a, b = app_client(), app_client()
    _login(a, "a@example.com"); _login(b, "b@example.com")
    cid = a.post("/screening/screen", json=screening_body()).json()["caseId"]
    assert b.get(f"/explain/{cid}").status_code == 404
    assert app_client().get(f"/explain/{cid}").status_code == 401


# ── gaze jobs ────────────────────────────────────────────────────────────────

def _fake_job(user="u1", state="processing", age_s=0.0):
    jid = "j" + str(len(jobs._jobs))
    jobs._jobs[jid] = {"id": jid, "user_id": user, "stage": "uploaded", "state": state, "result": None, "created": time.time() - age_s}
    return jid


def test_job_timeout_becomes_an_explicit_failure(monkeypatch):
    jobs._jobs.clear()
    jid = _fake_job(age_s=jobs.JOB_TIMEOUT_S + 5)
    j = jobs.get(jid, "u1")
    assert j["state"] == "done" and j["result"]["status"] == "unavailable" and j["result"]["reason"] == "job_timeout"
    assert j["result"]["probability"] is None


def test_job_is_only_visible_to_its_owner_and_active_jobs_are_capped():
    jobs._jobs.clear()
    jid = _fake_job("owner")
    assert jobs.get(jid, "owner") is not None and jobs.get(jid, "intruder") is None
    jobs._jobs.clear()
    for _ in range(jobs.MAX_ACTIVE_PER_USER):
        _fake_job("busy")
    with pytest.raises(jobs.TooManyJobs):
        jobs.submit("busy", __import__("pathlib").Path("/nonexistent"), 10.0, None)


def test_job_results_survive_a_restart_and_unfinished_jobs_are_reported_failed(app_client):
    from backend.core.database import get_db
    c = app_client()
    jobs._jobs.clear()
    done = {"id": "d1", "user_id": "u9", "stage": "complete", "state": "done", "created": time.time(),
            "result": {"modality": "gaze", "status": "success", "probability": 0.3, "quality": {"valid": True}}}
    running = {"id": "r1", "user_id": "u9", "stage": "running_model", "state": "processing", "created": time.time(), "result": None}
    jobs._persist(done); jobs._persist(running)
    assert get_db()["gaze_jobs"].count_documents({}) == 2
    jobs._jobs.clear()                                         # simulate a new process
    assert jobs.get("d1", "u9")["result"]["probability"] == 0.3
    r = jobs.get("r1", "u9")
    assert r["state"] == "done" and r["result"]["reason"] == "interrupted" and r["result"]["probability"] is None
    assert jobs.get("d1", "someone-else") is None


def test_upload_rejects_unsupported_and_empty_files_and_cleans_up(app_client, tmp_path, monkeypatch):
    import glob, tempfile
    c = app_client(); _login(c)
    before = set(glob.glob(tempfile.gettempdir() + "/ns_upload_*"))
    assert c.post("/gaze/analyze", files={"video": ("x.exe", b"MZ")}).status_code == 415
    assert c.post("/gaze/analyze", files={"video": ("x.webm", b"")}).status_code == 422
    assert set(glob.glob(tempfile.gettempdir() + "/ns_upload_*")) == before


# ── security ─────────────────────────────────────────────────────────────────

def test_registration_is_throttled(app_client):
    c = app_client()
    codes = [c.post("/auth/register", json={"name": "N", "email": f"u{i}@example.com", "password": PW}).status_code for i in range(12)]
    assert codes[:10] == [201] * 10 and codes[10:] == [429, 429]


def test_client_cannot_set_role_or_user_id_on_register(app_client):
    c = app_client()
    r = c.post("/auth/register", json={"name": "N", "email": "r@example.com", "password": PW, "role": "clinician"})
    assert r.status_code == 422
    assert _login(c, "ok@example.com").json()["user"]["role"] == "user"


def test_lab_endpoints_need_clinician_role(app_client, monkeypatch):
    monkeypatch.setenv("GAZE_LAB_ENABLED", "1")
    c = app_client(); _login(c)
    for method, path in (("get", "/gaze/lab/sessions"), ("post", "/gaze/lab/validate"), ("delete", "/gaze/lab/sessions")):
        assert getattr(c, method)(path).status_code == 403


def test_https_origin_requires_secure_cookie(monkeypatch):
    from backend.core import config
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    config.reset_settings()
    with pytest.raises(config.ConfigError):
        config.load_settings()
    monkeypatch.setenv("COOKIE_SECURE", "true")
    assert config.load_settings().cookie_secure is True
    config.reset_settings()


def test_health_reports_real_state_without_secrets(app_client):
    c = app_client()
    h = c.get("/").json()
    assert h["version"] == "3.2.0" and h["database"]["connected"] is True
    m = h["modalities"]
    assert m["questionnaire"]["clinically_validated"] is False and m["gaze"]["in_result"] is False
    assert m["speech"]["status"] == "model_unavailable" and m["facial"]["status"] == "model_unavailable"
    assert m["result"]["basis"] == "questionnaire_score_only"
    text = str(h).lower()
    assert "mongodb" not in text and "secret" not in text and "password" not in text


@pytest.mark.parametrize("category", ["adult", "child", "toddler"])
def test_shap_is_nontrivial_and_consistent_for_every_shipped_model(category):
    """Regression: the AdaBoost child model once got all-zero attributions (one-row background)."""
    import joblib
    from backend.ml.config import CATEGORY_MODEL_CONFIG
    from backend.ml.shap_engine import compute_shap
    from backend.tests.conftest import answers_scoring
    cfg = CATEGORY_MODEL_CONFIG[category]
    if not cfg["model_path"].exists():
        pytest.skip("model not present")
    model, enc, bg = joblib.load(cfg["model_path"]), joblib.load(cfg["encoders_path"]), np.load(cfg["background_path"])
    scoring_cat = "adult" if category == "toddler" else category
    X = preprocess_for_inference({"age": 8, "gender": "Male", "jaundice": "No", "familyAsd": "No", "ethnicity": "Other"},
                                 answers_scoring(8, scoring_cat), enc, category=category)
    res = compute_shap(model, X, feature_names_for(category), bg)
    assert res and max(abs(r["shap_value"]) for r in res) > 0.01
    assert {r["feature"] for r in res} <= set(feature_names_for(category))
    assert compute_shap(model, X, feature_names_for(category), None) is None or category != "child"   # kernel models need a background


def test_body_limit_is_small_for_json_but_allows_recording_uploads(app_client):
    """Regression: a normal 30 s recording (~10 MB) was rejected by the global 10 MB limit."""
    c = app_client(); _login(c)
    big = b"x" * (11 * 1024 * 1024)
    assert c.post("/screening/screen", content=big, headers={"Content-Type": "application/json"}).status_code == 413
    r = c.post("/gaze/analyze", files={"video": ("v.exe", big)})           # passes the size gate, then fails on file type
    assert r.status_code == 415
