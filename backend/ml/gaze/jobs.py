"""In-memory job store for asynchronous gaze analysis (the backend is the source of truth).

Results are held server-side, bound to the requesting user, and referenced by id from the
screening request, so the browser can never submit its own gaze probability."""

from __future__ import annotations

import os
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from . import openface as OF
from .service import get_gaze_service

TTL_S = 2 * 3600
STAGES = ("uploaded", "normalizing_video", "extracting_gaze_features", "running_model", "complete")

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _prune() -> None:
    now = time.time()
    for k in [k for k, j in _jobs.items() if now - j["created"] > TTL_S]:
        _jobs.pop(k, None)


def _set(job_id: str, **kw) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].update(kw)


def submit(user_id: str, video_path: Path, duration_s: Optional[float], session_id: Optional[str]) -> str:
    job_id = uuid.uuid4().hex
    with _lock:
        _prune()
        _jobs[job_id] = {"id": job_id, "user_id": user_id, "stage": "uploaded", "state": "processing",
                         "result": None, "created": time.time()}
    threading.Thread(target=_run, args=(job_id, video_path, duration_s, session_id), daemon=True).start()
    return job_id


def _run(job_id: str, video: Path, duration_s: Optional[float], session_id: Optional[str]) -> None:
    svc = get_gaze_service()
    base = svc._base(session_id)
    try:
        _set(job_id, stage="normalizing_video")
        import tempfile as _t
        with _t.TemporaryDirectory(prefix="ns_gaze_") as tmp:
            tmp = Path(tmp)
            norm = tmp / "recording.avi"
            try:
                OF.normalize_video(video, norm, duration_s)
                _set(job_id, stage="extracting_gaze_features")
                out = tmp / "of"; out.mkdir()
                df = OF.parse_output(OF.run_openface(norm, out))
            except OF.CorruptVideo as exc:
                result = svc._fail(base, "insufficient_quality", exc.code, "corrupt_video", str(exc))
            except OF.OpenFaceUnavailable as exc:
                result = svc._fail(base, "unavailable", exc.code, "openface_unavailable", str(exc))
            except OF.OpenFaceFailed as exc:
                result = svc._fail(base, "unavailable", exc.code, "openface_failed", str(exc))
            else:
                _set(job_id, stage="running_model")
                result = svc.analyze_frames(df, session_id)
    except Exception as exc:  # never leave a job hanging
        result = svc._fail(base, "unavailable", "GAZE_INFERENCE_FAILED", "internal_error", str(exc))
    finally:
        try:
            os.unlink(video)            # raw recording is never kept
        except OSError:
            pass
    _set(job_id, stage="complete", state="done", result=result)


def get(job_id: str, user_id: str) -> Optional[dict]:
    with _lock:
        j = _jobs.get(job_id)
        if not j or j["user_id"] != user_id:
            return None
        return dict(j)


def result_for(job_id: str, user_id: str) -> Optional[dict]:
    j = get(job_id, user_id)
    return j["result"] if j and j["state"] == "done" else None
