"""Response models for the OpenFace gaze API.  The browser sends a recording; every number in
these models is computed by the backend."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GazeQuality(BaseModel):
    valid: bool
    reason: Optional[str] = None
    error_code: Optional[str] = None
    reasons: list[str] = []
    sample_count: int
    valid_sample_count: int
    valid_sample_ratio: float
    mean_confidence: Optional[float] = None
    tracking_continuity: float
    duration_seconds: float
    window_count: int
    data_quality_score: float
    rejected: dict[str, int] = {}
    warnings: list[str] = []


class GazeAnalyzeResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    modality: str = "gaze"
    status: str                         # success | insufficient_quality | unavailable
    model_status: str                   # available | unavailable
    probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    prediction: Optional[str] = None    # asd_signal | typical_signal
    model_version: str
    dataset: str
    feature_schema_version: str
    session_id: Optional[str] = None
    analyzed_at: str
    error_code: Optional[str] = None
    reason: Optional[str] = None
    detail: Optional[str] = None
    quality: Optional[GazeQuality] = None
    features: dict = {}
    explanation: Optional[dict] = None
    fusion_eligible: bool = False
    fusion_reason: Optional[str] = None
    interpretation: str = ""


class GazeJobAccepted(BaseModel):
    job_id: str
    state: str = "processing"
    stage: str = "uploaded"


class GazeJobStatus(BaseModel):
    job_id: str
    state: str                          # processing | done
    stage: str                          # uploaded | normalizing_video | extracting_gaze_features | running_model | complete
    result: Optional[GazeAnalyzeResponse] = None
