"""Asynchronous gaze-analysis jobs (the backend is the source of truth).

Lifecycle: ``processing`` (stages: uploaded -> normalizing_video -> extracting_gaze_features -> running_model)
-> ``done`` (the result may itself be a failure: insufficient_quality / out_of_domain / unavailable).
* Results are bound to the requesting user and referenced by id from the screening request, so the browser can
  never submit its own gaze result.
* They are kept in memory AND in the ``gaze_jobs`` collection (TTL-indexed), so a server restart does not lose a
  finished analysis; a job that was still running when the process died is reported as failed, never as pending.
* A watchdog turns jobs older than JOB_TIMEOUT_S into an explicit ``analysis_failed`` result.
* At most MAX_ACTIVE_PER_USER jobs per user and MAX_CONCURRENT_RUNS OpenFace runs at a time."""

from __future__ import annotations

import os
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from . import openface as OF
from .service import get_gaze_service

TTL_S = 2 * 3600
JOB_TIMEOUT_S = 15 * 60
MAX_ACTIVE_PER_USER = 3
MAX_CONCURRENT_RUNS = 2
_run_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RUNS)
STAGES = ("uploaded", "normalizing_video", "extracting_gaze_features", "running_model", "complete")

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _prune() -> None:
    now = time.time()
    for k in [k for k, j in _jobs.items() if now - j["created"] > TTL_S]:
        _jobs.pop(k, None)


class TooManyJobs(RuntimeError):
    pass


def _db():
    """The jobs collection, or None when the database is unavailable (in-memory only then)."""
    try:
        try:
            from ...core.database import get_db
        except ImportError:  # pragma: no cover - backend/ as cwd
            from core.database import get_db
        col = get_db()["gaze_jobs"]
        return col
    except Exception:
        return None


def _persist(job: dict) -> None:
    col = _db()
    if col is None:
        return
    try:
        import json
        from datetime import datetime, timezone
        doc = {k: v for k, v in job.items() if k != "created"}
        doc["result"] = json.loads(json.dumps(job["result"], default=float)) if job.get("result") else None
        doc["created_at"] = datetime.fromtimestamp(job["created"], tz=timezone.utc)
        col.replace_one({"id": job["id"]}, doc, upsert=True)
    except Exception:
        pass             # persistence is best-effort; the in-memory job remains authoritative for this process


def ensure_indexes(db) -> None:
    db["gaze_jobs"].create_index("id", unique=True, name="idx_gaze_job_id")
    db["gaze_jobs"].create_index("created_at", expireAfterSeconds=TTL_S, name="idx_gaze_job_ttl")


def _set(job_id: str, **kw) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].update(kw)
            snapshot = dict(_jobs[job_id])
        else:
            return
    if kw.get("state") == "done" or "stage" in kw:
        _persist(snapshot)


LAB_DIR = Path(__file__).resolve().parents[2] / "data" / "webcam_validation"


def lab_enabled() -> bool:
    return os.environ.get("GAZE_LAB_ENABLED", "0").lower() in ("1", "true")


def submit(user_id: str, video_path: Path, duration_s: Optional[float], session_id: Optional[str],
           keep_features: bool = False) -> str:
    job_id = uuid.uuid4().hex
    with _lock:
        _prune()
        if sum(1 for j in _jobs.values() if j["user_id"] == user_id and j["state"] == "processing") >= MAX_ACTIVE_PER_USER:
            raise TooManyJobs(f"at most {MAX_ACTIVE_PER_USER} gaze analyses can run at once")
        _jobs[job_id] = {"id": job_id, "user_id": user_id, "stage": "uploaded", "state": "processing",
                         "result": None, "created": time.time()}
    _persist(_jobs[job_id])
    threading.Thread(target=_run, args=(job_id, video_path, duration_s, session_id, keep_features), daemon=True).start()
    return job_id


def _run(job_id: str, video: Path, duration_s: Optional[float], session_id: Optional[str],
         keep_features: bool = False) -> None:
    svc = get_gaze_service()
    base = svc._base(session_id)
    timings: dict = {}
    t_job = time.perf_counter()
    _run_slots.acquire()
    try:
        _set(job_id, stage="normalizing_video")
        import tempfile as _t
        with _t.TemporaryDirectory(prefix="ns_gaze_") as tmp:
            tmp = Path(tmp)
            norm = tmp / "recording.avi"
            try:
                t0 = time.perf_counter()
                OF.normalize_video(video, norm, duration_s)
                timings["normalize_video"] = time.perf_counter() - t0
                _set(job_id, stage="extracting_gaze_features")
                out = tmp / "of"; out.mkdir()
                t0 = time.perf_counter()
                df = OF.parse_output(OF.run_openface(norm, out))
                timings["openface"] = time.perf_counter() - t0
                if keep_features and lab_enabled():      # numbers only, never the video
                    LAB_DIR.mkdir(parents=True, exist_ok=True)
                    df.to_csv(LAB_DIR / f"{job_id}.csv", index=False)
            except OF.CorruptVideo as exc:
                result = svc._fail(base, "insufficient_quality", exc.code, "corrupt_video", str(exc))
            except OF.OpenFaceUnavailable as exc:
                result = svc._fail(base, "unavailable", exc.code, "openface_unavailable", str(exc))
            except OF.OpenFaceFailed as exc:
                result = svc._fail(base, "unavailable", exc.code, "openface_failed", str(exc))
            else:
                _set(job_id, stage="running_model")
                t0 = time.perf_counter()
                result = svc.analyze_frames(df, session_id)
                timings["preprocess_and_model"] = time.perf_counter() - t0
    except Exception as exc:  # never leave a job hanging
        result = svc._fail(base, "unavailable", "GAZE_INFERENCE_FAILED", "internal_error", str(exc))
    finally:
        _run_slots.release()
        try:
            os.unlink(video)            # raw recording is never kept
        except OSError:
            pass
    timings["total"] = time.perf_counter() - t_job
    result["timings_s"] = {k: round(v, 3) for k, v in timings.items()}     # measured, not estimated
    with _lock:
        if _jobs.get(job_id, {}).get("state") == "done":      # the watchdog already failed it; keep that outcome
            return
    _set(job_id, stage="complete", state="done", result=result)


def _failure(session_id: Optional[str], reason: str, detail: str) -> dict:
    svc = get_gaze_service()
    return svc._fail(svc._base(session_id), "unavailable", "GAZE_INFERENCE_FAILED", reason, detail)


def get(job_id: str, user_id: str) -> Optional[dict]:
    """The caller's job, or None (also for someone else's job)."""
    timed_out = False
    with _lock:
        j = _jobs.get(job_id)
        if j is not None:
            if j["user_id"] != user_id:
                return None
            if j["state"] == "processing" and time.time() - j["created"] > JOB_TIMEOUT_S:
                j.update(state="done", stage="complete", result=_failure(None, "job_timeout",
                                                                         f"analysis exceeded {JOB_TIMEOUT_S // 60} minutes"))
                timed_out = True
            snapshot = dict(j)
        else:
            snapshot = None
    if snapshot is not None:
        if timed_out:
            _persist(snapshot)
        return snapshot
    col = _db()                                   # not in this process: look in the database (restart / other worker)
    if col is None:
        return None
    doc = col.find_one({"id": job_id, "user_id": user_id}, {"_id": 0})
    if doc is None:
        return None
    doc["created"] = doc["created_at"].timestamp() if doc.get("created_at") else time.time()
    doc.pop("created_at", None)
    if doc["state"] == "processing":              # the process that owned it is gone
        doc.update(state="done", stage="complete",
                   result=_failure(None, "interrupted", "the server restarted while the analysis was running"))
        _persist(doc)
    return doc


def result_for(job_id: str, user_id: str) -> Optional[dict]:
    j = get(job_id, user_id)
    return j["result"] if j and j["state"] == "done" else None
