"""Gaze analysis endpoint. Thin: validation is Pydantic, logic is GazeModelService."""

from __future__ import annotations

from fastapi import APIRouter, Depends

try:
    from ..core.auth import get_current_user
    from ..ml.gaze.gaze_model_service import get_gaze_service
    from ..schemas.gaze import GazeAnalyzeRequest, GazeAnalyzeResponse
except ImportError:  # pragma: no cover - backend/ as cwd
    from core.auth import get_current_user
    from ml.gaze.gaze_model_service import get_gaze_service
    from schemas.gaze import GazeAnalyzeRequest, GazeAnalyzeResponse

router = APIRouter(prefix="/gaze", tags=["Gaze"], dependencies=[Depends(get_current_user)])


@router.post("/analyze", response_model=GazeAnalyzeResponse)
def analyze_gaze(body: GazeAnalyzeRequest) -> dict:
    """Quality-check and score one gaze session. 422 on a malformed payload;
    200 with status ``insufficient_quality`` / ``unavailable`` and a reason otherwise."""
    return get_gaze_service().analyze(body.model_dump())


@router.get("/status")
def gaze_status() -> dict:
    return get_gaze_service().status()


@router.get("/model-info")
def gaze_model_info() -> dict:
    """Authenticated: input contract, provenance and evaluation of the loaded checkpoint."""
    return get_gaze_service().get_model_info()
