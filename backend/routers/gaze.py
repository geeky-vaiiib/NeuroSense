"""Gaze endpoints.  The browser uploads a short recording; OpenFace + the trained model run on the
server in a background thread.  Poll /gaze/jobs/{id} for honest stage names and the result."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

try:
    from ..core.auth import CurrentUser, get_current_user, require_roles
    from ..ml.gaze import jobs
    from ..ml.gaze.service import get_gaze_service
    from ..schemas.gaze import GazeJobAccepted, GazeJobStatus
except ImportError:  # pragma: no cover - backend/ as cwd
    from core.auth import CurrentUser, get_current_user, require_roles
    from ml.gaze import jobs
    from ml.gaze.service import get_gaze_service
    from schemas.gaze import GazeJobAccepted, GazeJobStatus

router = APIRouter(prefix="/gaze", tags=["Gaze"], dependencies=[Depends(get_current_user)])

MAX_UPLOAD_BYTES = 150 * 1024 * 1024
ALLOWED_SUFFIX = {".webm", ".mp4", ".mov", ".avi", ".mkv"}


@router.post("/analyze", response_model=GazeJobAccepted, status_code=202)
async def analyze_gaze(
    video: UploadFile = File(...),
    duration_ms: Optional[float] = Form(default=None, ge=1000, le=180_000),
    session_id: Optional[str] = Form(default=None, max_length=64),
    keep_features: bool = Form(default=False),
    user: CurrentUser = Depends(get_current_user),
):
    """Accept a recording and start analysis.  202 + job id; no raw video is retained."""
    if keep_features and not jobs.lab_enabled():
        raise HTTPException(status_code=403, detail="gaze lab is disabled (set GAZE_LAB_ENABLED=1)")
    if keep_features and user.role != "clinician":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    suffix = Path(video.filename or "").suffix.lower() or ".webm"
    if suffix not in ALLOWED_SUFFIX:
        raise HTTPException(status_code=415, detail=f"unsupported video type {suffix}")
    fd, tmp = tempfile.mkstemp(prefix="ns_upload_", suffix=suffix)
    size = 0
    try:
        with open(fd, "wb") as fh:
            while chunk := await video.read(1 << 20):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="video too large")
                fh.write(chunk)
        if size == 0:
            raise HTTPException(status_code=422, detail="empty upload")
    except Exception:
        Path(tmp).unlink(missing_ok=True)
        raise
    try:
        job_id = jobs.submit(user.user_id, Path(tmp), duration_ms / 1000.0 if duration_ms else None, session_id, keep_features)
    except jobs.TooManyJobs as exc:
        Path(tmp).unlink(missing_ok=True)
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    return GazeJobAccepted(job_id=job_id)


@router.get("/jobs/{job_id}", response_model=GazeJobStatus)
def gaze_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
    j = jobs.get(job_id, user.user_id)
    if j is None:
        raise HTTPException(status_code=404, detail="unknown gaze job")
    return GazeJobStatus(job_id=job_id, state=j["state"], stage=j["stage"], result=j["result"])


@router.get("/status")
def gaze_status() -> dict:
    return get_gaze_service().status()


@router.get("/model-info")
def gaze_model_info() -> dict:
    return get_gaze_service().get_model_info()


# ── Gaze lab: collect OpenFace features from real webcam sessions and run the domain check ──

def _require_lab() -> None:
    if not jobs.lab_enabled():
        raise HTTPException(status_code=403, detail="gaze lab is disabled (set GAZE_LAB_ENABLED=1)")


@router.get("/lab/sessions")
def lab_sessions(_: CurrentUser = Depends(require_roles("clinician"))) -> dict:
    """Sessions saved for the webcam domain check (OpenFace numbers only) + current validation state."""
    _require_lab()
    from ..ml.gaze import preprocess as P, quality as Q  # noqa: PLC0415
    import pandas as pd  # noqa: PLC0415
    sessions = []
    for f in sorted(jobs.LAB_DIR.glob("*.csv")) if jobs.LAB_DIR.exists() else []:
        q = Q.assess(P.prepare_session(pd.read_csv(f)))
        sessions.append({"id": f.stem, "quality_valid": q.valid, "reason": q.reason, "duration_s": q.duration_seconds,
                         "data_quality_score": q.data_quality_score, "windows": q.window_count})
    svc = get_gaze_service()
    return {"sessions": sessions, "validation": svc.webcam_validation(), "fusion": svc.fusion_eligibility()[0]}


@router.post("/lab/validate")
def lab_validate(_: CurrentUser = Depends(require_roles("clinician"))) -> dict:
    """Run the pre-registered domain check on the saved sessions; a pass unlocks gaze in fusion."""
    _require_lab()
    from ..data import validate_webcam_domain as V  # noqa: PLC0415
    res = V.main(["--csv-dir", str(jobs.LAB_DIR)])
    from ..ml.gaze.service import reset_gaze_service  # noqa: PLC0415
    reset_gaze_service()
    return {k: res[k] for k in ("passed", "n_sessions", "n_quality_valid", "domain_counts", "checks", "reason", "sessions")}


@router.delete("/lab/sessions")
def lab_clear(_: CurrentUser = Depends(require_roles("clinician"))) -> dict:
    _require_lab()
    n = 0
    for f in jobs.LAB_DIR.glob("*.csv") if jobs.LAB_DIR.exists() else []:
        f.unlink(); n += 1
    return {"deleted": n}
