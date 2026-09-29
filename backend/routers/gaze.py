"""Gaze analysis endpoint. Thin: validation is Pydantic, logic is GazeModelService."""

from __future__ import annotations

from fastapi import APIRouter

try:
    from ..ml.gaze.gaze_model_service import get_gaze_service
    from ..schemas.gaze import GazeAnalyzeRequest, GazeAnalyzeResponse
except ImportError:  # pragma: no cover - backend/ as cwd
    from ml.gaze.gaze_model_service import get_gaze_service
    from schemas.gaze import GazeAnalyzeRequest, GazeAnalyzeResponse

router = APIRouter(prefix="/gaze", tags=["Gaze"])


@router.post("/analyze", response_model=GazeAnalyzeResponse)
def analyze_gaze(body: GazeAnalyzeRequest) -> dict:
    """Quality-check and score one gaze session. 422 on a malformed payload;
    200 with status ``insufficient_quality`` / ``unavailable`` and a reason otherwise."""
    return get_gaze_service().analyze(body.model_dump())


@router.get("/status")
def gaze_status() -> dict:
    return get_gaze_service().status()
