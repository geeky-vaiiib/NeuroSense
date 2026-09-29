"""Canonical gaze-session schema shared by the frontend, API, service and storage.

Sample fields
  timestamp      measured  ms, monotonic clock (performance.now())
  x, y           measured  viewport pixels; null only when face_detected is false
  stimulus_id    measured  which stimulus was on screen
  face_detected  measured
  confidence     unavailable from WebGazer -> optional, ignored by the model
dt, fixation and speed are derived on the server; a client-supplied ``dt`` is
not part of the schema.  Pupil diameter is unavailable in browsers and is
deliberately not a field.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GazeSample(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: float
    x: Optional[float] = None
    y: Optional[float] = None
    stimulus_id: Optional[str] = Field(default=None, max_length=64)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    face_detected: bool = True


class CalibrationInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    completed: bool
    quality_score: float = Field(..., ge=0.0, le=1.0)
    sample_count: int = Field(..., ge=0, le=100000)
    mean_error_px: Optional[float] = Field(default=None, ge=0.0)
    method: Optional[str] = Field(default=None, max_length=64)


class GazeAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    session_id: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., pattern="^(adult|child|toddler)$")
    screen_width: float = Field(..., ge=200, le=10000)
    screen_height: float = Field(..., ge=200, le=10000)
    calibration: CalibrationInfo
    samples: list[GazeSample] = Field(..., max_length=20000)

    @model_validator(mode="after")
    def _visible_samples_have_coordinates(self):
        for s in self.samples:
            if s.face_detected and (s.x is None or s.y is None):
                raise ValueError("samples with face_detected=true require x and y")
        return self


class GazeQuality(BaseModel):
    valid: bool
    reason: Optional[str] = None
    reasons: list[str] = []
    sample_count: int
    valid_sample_count: int
    valid_ratio: float
    calibration_score: Optional[float] = None
    duration_s: float
    sequence_steps: int
    rejected: dict[str, int] = {}


class GazeAnalyzeResponse(BaseModel):
    modality: str = "gaze"
    status: str                       # success | insufficient_quality | unavailable
    probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    model_status: str                 # trained | unavailable
    model_version: Optional[str] = None
    reason: Optional[str] = None
    detail: Optional[str] = None
    session_id: Optional[str] = None
    analyzed_at: str
    quality: GazeQuality
    features: dict = {}
    interpretation: str = ""
