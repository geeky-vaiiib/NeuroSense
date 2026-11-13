"""Durable gaze jobs; MongoDB is authoritative across application workers.

Owner leases are renewed while queued and running. Pollers expire only an elapsed
lease/deadline, never a local cache miss. Terminal updates use compare-and-set.
Timeout stops accepting results; it does NOT cancel native computation. Admission
and OpenFace semaphores remain process-local (deploy one worker; see RUNTIME.md).
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from . import openface as OF
from .service import get_gaze_service

logger = logging.getLogger("neurosense.gaze.jobs")
TTL_S = 2 * 3600
JOB_TIMEOUT_S = 15 * 60
LEASE_S = 60
HEARTBEAT_S = 10
MAX_ACTIVE_PER_USER = 3
MAX_CONCURRENT_RUNS = 2
_run_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RUNS)
STAGES = ("uploaded", "normalizing_video", "extracting_gaze_features", "running_model", "complete")
_jobs: dict[str, dict] = {}  # diagnostic cache only; never used for polling/ownership
_lock = threading.Lock()
_threads: set[threading.Thread] = set()


class TooManyJobs(RuntimeError):
    pass


def _db():
    try:
        from ...core.database import get_db
    except ImportError:  # backend directory entrypoint
        from core.database import get_db
    return get_db()["gaze_jobs"]  # durable storage is mandatory; never silently downgrade


def ensure_indexes(db) -> None:
    db["gaze_jobs"].create_index("id", unique=True, name="idx_gaze_job_id")
    db["gaze_jobs"].create_index("created_at", expireAfterSeconds=TTL_S, name="idx_gaze_job_ttl")
    db["gaze_jobs"].create_index([("user_id", 1), ("state", 1)], name="idx_gaze_owner_state")


def _persist(job: dict) -> None:
    """Insert-only helper, also used by lifecycle fixtures; cannot overwrite a terminal job."""
    doc = dict(job)
    doc.setdefault("created_at", datetime.fromtimestamp(doc["created"], tz=timezone.utc))
    _db().insert_one(doc)


def _set(job_id: str, owner_token: str, **kw) -> bool:
    now = time.time()
    r = _db().update_one({"id": job_id, "owner_token": owner_token, "state": "processing",
                          "lease_until": {"$gt": now}, "deadline": {"$gt": now}}, {"$set": kw})
    return r.matched_count == 1


LAB_DIR = Path(__file__).resolve().parents[2] / "data" / "webcam_validation"


def lab_enabled() -> bool:
    return os.environ.get("GAZE_LAB_ENABLED", "0").lower() in ("1", "true")


def _recover(query: dict) -> None:
    now = time.time()
    for doc in _db().find({**query, "state": "processing"}):
        created = doc.get("created")
        if created is None and isinstance(doc.get("created_at"), datetime):
            stamp = doc["created_at"]
            created = (stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)).timestamp()
        deadline = doc.get("deadline", (created or 0) + JOB_TIMEOUT_S)
        lease = doc.get("lease_until", deadline)  # old jobs get a bounded migration grace, not instant failure
        reason = "job_timeout" if deadline <= now else "interrupted" if lease <= now else None
        if reason:
            detail = ("Analysis deadline exceeded; computation may still be running." if reason == "job_timeout"
                      else "The owner's heartbeat lease expired; computation may still be running.")
            # Include observed lease so a concurrent renewal wins safely.
            _db().update_one({"id": doc["id"], "state": "processing",
                              "lease_until": doc.get("lease_until"), "deadline": doc.get("deadline")},
                             {"$set": {"state": "done", "stage": "complete", "result": _failure(None, reason, detail)}})


def _heartbeat(job_id: str, token: str, stop: threading.Event) -> None:
    while not stop.wait(HEARTBEAT_S):
        try:
            if not _set(job_id, token, heartbeat_at=time.time(), lease_until=time.time() + LEASE_S):
                return
        except Exception:
            logger.exception("Gaze heartbeat persistence failed (job=%s)", job_id)
            return  # no false success; another poller recovers after the lease expires


def submit(user_id: str, video_path: Path, duration_s: Optional[float], session_id: Optional[str],
           keep_features: bool = False, population: str = "adult") -> str:
    job_id, token = uuid.uuid4().hex, uuid.uuid4().hex
    try:
        with _lock:
            _recover({"user_id": user_id})
            if _db().count_documents({"user_id": user_id, "state": "processing"}) >= MAX_ACTIVE_PER_USER:
                raise TooManyJobs(f"at most {MAX_ACTIVE_PER_USER} gaze analyses can run at once")
            now = time.time()
            _persist({"id": job_id, "owner_token": token, "user_id": user_id, "stage": "uploaded",
                      "state": "processing", "population": population, "result": None, "created": now, "heartbeat_at": now,
                      "lease_until": now + LEASE_S, "deadline": now + JOB_TIMEOUT_S, "raw_path": str(video_path)})
            thread = threading.Thread(target=_run, args=(job_id, token, video_path, duration_s, session_id, keep_features, population), daemon=True)
            _threads.add(thread)
            thread.start()
        return job_id
    except Exception:
        video_path.unlink(missing_ok=True)
        # If thread creation failed, make the durable submission explicitly terminal.
        try:
            _set(job_id, token, state="done", stage="complete", result=_failure(session_id, "submission_failed", "Could not start processing."))
        except Exception:
            logger.exception("Could not persist rejected gaze submission")
        raise


def _run(job_id: str, owner_token: str, video: Path, duration_s: Optional[float], session_id: Optional[str],
         keep_features: bool = False, population: str = "adult") -> None:
    svc = None
    stop = threading.Event()
    heartbeat = threading.Thread(target=_heartbeat, args=(job_id, owner_token, stop), daemon=True)
    heartbeat.start()
    timings: dict = {}
    recording_timing = None
    t_job = time.perf_counter()
    acquired = False
    try:
        _run_slots.acquire()
        acquired = True
        if population == 'toddler':
            from ..toddler_recordings import ToddlerGazeMeasurements
            svc = ToddlerGazeMeasurements()
        else:
            svc = get_gaze_service()
        base = svc._base(session_id)
        if not _set(job_id, owner_token, stage="normalizing_video"):
            return
        import tempfile as _t
        try:
            from ...core.recordings import spool
        except ImportError:  # backend directory entrypoint
            from core.recordings import spool
        with _t.TemporaryDirectory(prefix="ns_gaze_", dir=spool()) as tmp:
            tmp = Path(tmp)
            norm = tmp / "recording.avi"
            try:
                t0 = time.perf_counter()
                info = OF.normalize_video(video, norm, duration_s)
                if info is not None:
                    from dataclasses import asdict
                    recording_timing = asdict(info)
                timings["normalize_video"] = time.perf_counter() - t0
                _set(job_id, owner_token, stage="extracting_gaze_features")
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
                _set(job_id, owner_token, stage="measuring_toddler_gaze" if population == "toddler" else "running_model")
                t0 = time.perf_counter()
                result = svc.analyze_frames(df, session_id)
                result['input_population'] = population
                timings["preprocess_and_model"] = time.perf_counter() - t0
    except Exception as exc:  # never leave a job hanging
        logger.exception("Gaze processing failed (job=%s)", job_id)
        result = _failure(session_id, "internal_error", "Analysis failed; see server logs.")
    finally:
        stop.set()
        heartbeat.join(timeout=HEARTBEAT_S + 1)
        if acquired:
            _run_slots.release()
        with _lock:
            _threads.discard(threading.current_thread())
        try:
            os.unlink(video)            # raw recording is never kept
        except OSError:
            pass
    timings["total"] = time.perf_counter() - t_job
    result["input_population"] = population
    result["recording_timing"] = recording_timing
    result["timings_s"] = {k: round(v, 3) for k, v in timings.items()}     # measured, not estimated
    try:
        _set(job_id, owner_token, stage="complete", state="done", result=result)
    except Exception:
        logger.exception("Gaze completion persistence failed (job=%s); lease recovery will apply", job_id)


def _failure(session_id: Optional[str], reason: str, detail: str) -> dict:
    return {"modality": "gaze", "status": "unavailable", "probability": None,
            "model_status":"unavailable", "model_version":"not_executed", "dataset":"Unavailable",
            "feature_schema_version":"unavailable", "analyzed_at":datetime.now(timezone.utc).isoformat(),
            "reason": reason, "detail": detail, "error_code": "GAZE_INFERENCE_FAILED",
            "session_id": session_id, "fusion_eligible": False}


def get(job_id: str, user_id: str) -> Optional[dict]:
    query = {"id": job_id, "user_id": user_id}
    _recover(query)
    return _db().find_one(query, {"_id": 0, "owner_token": 0, "raw_path": 0})


def result_for(job_id: str, user_id: str) -> Optional[dict]:
    j = get(job_id, user_id)
    if not j or j['state'] != 'done':
        return None
    return {**j['result'], 'input_population':j['population']} if j.get('population') else j['result']


def shutdown(wait_s: float = 5) -> None:
    """Bounded drain. Unfinished jobs retain leases; no claim of cancellation."""
    until = time.monotonic() + wait_s
    for thread in list(_threads):
        thread.join(timeout=max(0, until - time.monotonic()))
