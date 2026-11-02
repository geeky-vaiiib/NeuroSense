"""Durable lifecycle tests use mongomock and controlled processing; no OpenFace."""
import threading
import time
from pathlib import Path

import pytest

from backend.ml.gaze import jobs
from backend.ml import model


def seed(mongo, **updates):
    now = time.time()
    j = dict(id="j", user_id="owner", owner_token="worker-a", created=now, deadline=now + 100,
             lease_until=now + 60, state="processing", stage="running_model", result=None)
    j.update(updates)
    jobs._persist(j)
    return j


def test_cross_worker_cache_miss_keeps_live_job(mongo):
    seed(mongo)
    jobs._jobs.clear()
    assert jobs.get("j", "owner")["state"] == "processing"
    assert jobs.get("j", "other") is None
    assert "owner_token" not in jobs.get("j", "owner")


@pytest.mark.parametrize("updates,reason", [({"lease_until": 0}, "interrupted"), ({"deadline": 0}, "job_timeout")])
def test_recovery_and_late_completion_cannot_overwrite(mongo, updates, reason):
    seed(mongo, **updates)
    recovered = jobs.get("j", "owner")
    assert recovered["state"] == "done"
    assert recovered["result"]["reason"] == reason
    assert recovered["result"]["probability"] is None
    assert not jobs._set("j", "worker-a", state="done", result={"status": "success"})
    assert jobs.get("j", "owner") == recovered


def test_owner_token_and_atomic_terminal_transition(mongo):
    seed(mongo)
    assert not jobs._set("j", "wrong", stage="complete")
    assert jobs._set("j", "worker-a", state="done", result={"status": "unavailable"})
    assert not jobs._set("j", "worker-a", state="done", result={"status": "success"})


def test_renewal_before_recovery_is_preserved(mongo):
    seed(mongo)
    assert jobs._set("j", "worker-a", lease_until=time.time() + 120)
    assert jobs.get("j", "owner")["state"] == "processing"


@pytest.mark.parametrize("failure", [False, True])
def test_processing_boundary_cleans_recordings(mongo, tmp_path, monkeypatch, failure):
    video = tmp_path / "video.webm"; video.write_bytes(b"fixture")
    seed(mongo)
    def normalize(*args):
        if failure:
            raise RuntimeError("controlled failure")
    monkeypatch.setattr(jobs.OF, "normalize_video", normalize)
    monkeypatch.setattr(jobs.OF, "run_openface", lambda *a: None)
    monkeypatch.setattr(jobs.OF, "parse_output", lambda *a: None)
    class FakeService:
        def _base(self, session): return {}
        def analyze_frames(self, *a): return {"status": "success", "modality": "gaze", "probability": .2}
    monkeypatch.setattr(jobs, "get_gaze_service", FakeService)
    jobs._run("j", "worker-a", video, 10, None)
    assert not video.exists()
    assert jobs.get("j", "owner")["state"] == "done"
    assert jobs.get("j", "owner")["result"]["status"] == ("unavailable" if failure else "success")


def test_rejected_submission_cleans_raw_file(mongo, tmp_path):
    seed(mongo)
    mongo.gaze_jobs.update_one({"id": "j"}, {"$set": {"user_id": "owner"}})
    for i in range(2):
        seed(mongo, id=f"extra{i}")
    video = tmp_path / "reject.webm"; video.write_bytes(b"fixture")
    with pytest.raises(jobs.TooManyJobs):
        jobs.submit("owner", video, 10, None)
    assert not video.exists()


@pytest.mark.parametrize("artifact", ["model_path", "encoders_path", "background_path"])
def test_corrupt_optional_artifact_does_not_abort_registry(tmp_path, monkeypatch, artifact):
    import joblib
    from sklearn.dummy import DummyClassifier
    import numpy as np
    cfg = {k: tmp_path / k for k in ("model_path", "encoders_path", "background_path")}
    joblib.dump(DummyClassifier().fit([[0], [1]], [0, 1]), cfg["model_path"])
    joblib.dump({}, cfg["encoders_path"])
    with cfg["background_path"].open("wb") as f: np.save(f, [[0]])
    cfg[artifact].write_bytes(b"corrupt")
    monkeypatch.setattr(model, "CATEGORY_MODEL_CONFIG", {"child": cfg})
    b = model.load_models()["child"]
    if artifact == "background_path":
        assert b["model"] is not None and b["background"] is None
    else:
        assert b["model"] is None and b["status"] == "model_unavailable"


def test_incompatible_optional_artifact_is_unavailable(tmp_path, monkeypatch):
    from sklearn.exceptions import InconsistentVersionWarning
    import warnings
    p = tmp_path / "artifact"; p.touch()
    monkeypatch.setattr(model, "CATEGORY_MODEL_CONFIG", {"child": {"model_path": p, "encoders_path": p}})
    def incompatible(*a):
        warnings.warn(InconsistentVersionWarning(estimator_name="Test", current_sklearn_version="x", original_sklearn_version="y"))
    monkeypatch.setattr(model.joblib, "load", incompatible)
    assert model.load_models()["child"]["model"] is None


def test_spool_retention_preserves_live_lease_and_unrelated_files(mongo, monkeypatch, tmp_path):
    import os
    from backend.core import recordings
    monkeypatch.setenv('NS_RECORDING_TMP_DIR', str(tmp_path))
    stale=tmp_path/'ns_upload_stale.webm'; stale.write_bytes(b'x')
    live=tmp_path/'ns_upload_live.webm'; live.write_bytes(b'x')
    other=tmp_path/'unrelated'; other.write_bytes(b'x')
    for p in (stale, live, other): os.utime(p,(0,0))
    seed(mongo, raw_path=str(live))
    assert recordings.cleanup_expired()==1
    assert not stale.exists() and live.exists() and other.exists()


def test_core_readiness_does_not_require_optional_models(app_client, monkeypatch):
    c=app_client(); c.app.state.model_registry={}
    assert c.get('/live').status_code==200 and c.get('/ready').status_code==200
    from backend.main import _db_status
    monkeypatch.setattr('backend.main._db_status',lambda:{'connected':False})
    assert c.get('/ready').status_code==503


def test_corrupt_models_still_allow_application_scoring(app_client, tmp_path, monkeypatch):
    p=tmp_path/'broken.pkl'; p.write_bytes(b'broken pickle')
    monkeypatch.setattr(model,'CATEGORY_MODEL_CONFIG',{'child':{'model_path':p,'encoders_path':p}})
    c=app_client()
    assert c.get('/ready').status_code==200
    assert c.get('/').json()['modelsLoaded']['child'] is False
    c.post('/auth/register',json={'name':'N','email':'model-fail@example.com','password':'correct-horse-9'})
    from backend.tests.conftest import screening_body
    response=c.post('/screening/screen',json=screening_body(6)).json()
    assert response['aq10Score']==6 and response['questionnaireBasis']['meets_threshold'] is True
    assert response['modelOutput'] is None


def test_missing_optional_artifacts(tmp_path, monkeypatch):
    p=tmp_path/'missing'
    monkeypatch.setattr(model,'CATEGORY_MODEL_CONFIG',{'child':{'model_path':p,'encoders_path':p}})
    b=model.load_models()['child']
    assert b['model'] is None and b['reason'] and b['status']=='model_unavailable'


def test_slow_explanation_does_not_block_session_restoration(app_client, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from backend.routers import explainability
    from backend.tests.conftest import screening_body
    c=app_client()
    c.post('/auth/register',json={'name':'N','email':'slow-xai@example.com','password':'correct-horse-9'})
    cid=c.post('/screening/screen',json=screening_body(8)).json()['caseId']
    entered=threading.Event(); release=threading.Event()
    def slow(**kwargs):
        entered.set(); release.wait(3); return None
    monkeypatch.setattr(explainability,'compute_shap',slow)
    monkeypatch.setattr(explainability,'compute_lime',lambda **kwargs:None)
    with ThreadPoolExecutor() as pool:
        future=pool.submit(c.get,f'/explain/{cid}')
        assert entered.wait(2)
        try:
            started=time.monotonic()
            assert c.get('/auth/me').status_code==200
            assert time.monotonic()-started<1
        finally: release.set()
        assert future.result().status_code==200


def test_logout_storage_failure_is_not_reported_as_revocation(app_client, monkeypatch):
    from backend.core.database import get_revoked_tokens_collection
    c=app_client()
    c.post('/auth/register',json={'name':'N','email':'logout-fail@example.com','password':'correct-horse-9'})
    def fail(*a,**k): raise RuntimeError('controlled database failure')
    monkeypatch.setattr(get_revoked_tokens_collection(),'insert_one',fail)
    with pytest.raises(RuntimeError,match='controlled database failure'):
        c.post('/auth/logout')
    assert c.get('/auth/me').status_code==200


@pytest.mark.parametrize('age_s,expected',[(30,'processing'),(jobs.JOB_TIMEOUT_S+1,'done')])
def test_pre_lease_documents_use_original_utc_creation_time(mongo, age_s, expected):
    from datetime import datetime,timezone
    # Old versions persisted only created_at; MongoDB returns naive UTC by default.
    mongo.gaze_jobs.insert_one({'id':'old','user_id':'owner','state':'processing','stage':'running_model',
                               'result':None,'created_at':datetime.fromtimestamp(time.time()-age_s,timezone.utc)})
    j=jobs.get('old','owner')
    assert j['state']==expected
    if expected=='done': assert j['result']['reason']=='job_timeout'


def test_serialization_warning_with_newlines_disables_optional_bundle(tmp_path, monkeypatch):
    import warnings
    from sklearn.dummy import DummyClassifier
    clf=DummyClassifier().fit([[0],[1]],[0,1])
    p=tmp_path/'artifact'; p.touch()
    monkeypatch.setattr(model,'CATEGORY_MODEL_CONFIG',{'child':{'model_path':p,'encoders_path':p}})
    def incompatible(*args):
        warnings.warn('Runtime warning:\nserialized model from an incompatible library',UserWarning)
        return clf
    monkeypatch.setattr(model.joblib,'load',incompatible)
    assert model.load_models()['child']['model'] is None
