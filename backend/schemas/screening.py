"""
schemas/screening.py — Pydantic models for the NeuroSense screening API.

Request:  ScreeningRequest  — demographics + AQ-10 answers
Response: ScreeningResponse — risk level, fusion score, case ID
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────
class GenderEnum(str, Enum):
    male = "Male"
    female = "Female"
    non_binary = "Non-binary"
    prefer_not = "Prefer not to say"


class RiskLevel(str, Enum):
    high = "High"
    moderate = "Moderate"
    low = "Low"


class JaundiceEnum(str, Enum):
    yes = "Yes"
    no = "No"


class FamilyAsdEnum(str, Enum):
    yes = "Yes"
    no = "No"


# ── Request ────────────────────────────────────────────────────────
class Demographics(BaseModel):
    """Patient demographic data from Step 1 of the wizard."""
    name: Optional[str] = Field(None, description="Full name (optional)")
    age: int = Field(..., ge=1, le=100, description="Patient age in years")
    gender: GenderEnum
    ethnicity: Optional[str] = Field(None, description="Ethnicity label")
    jaundice: Optional[JaundiceEnum] = Field(None, description="Jaundice at birth")
    family_asd: Optional[FamilyAsdEnum] = Field(None, alias="familyAsd",
                                                  description="Family history of ASD")


class AQ10Answers(BaseModel):
    """AQ-10 questionnaire answers — keyed A1 through A10."""
    A1: str
    A2: str
    A3: str
    A4: str
    A5: str
    A6: str
    A7: str
    A8: str
    A9: str
    A10: str


class ScreeningRequest(BaseModel):
    """Full screening submission payload."""
    demo: Demographics
    answers: AQ10Answers
    aq10_score: int = Field(..., ge=0, le=10, alias="aq10Score",
                            description="Pre-computed AQ-10 sum score")

    model_config = {"populate_by_name": True}


# ── Response ───────────────────────────────────────────────────────
class ScreeningResponse(BaseModel):
    """Result returned after ML inference."""
    case_id: str = Field(..., alias="caseId", description="Generated case identifier")
    status: str = Field("processing", description="Current processing status")
    risk_level: RiskLevel = Field(..., alias="riskLevel")
    fusion_score: float = Field(..., ge=0.0, le=1.0, alias="fusionScore",
                                 description="Ensemble fusion probability")
    aq10_score: int = Field(..., alias="aq10Score")

    model_config = {"populate_by_name": True}


class CaseOut(BaseModel):
    """Case object returned by GET /cases endpoints."""
    id: str
    patient_name: Optional[str] = Field(None, alias="patientName")
    age: int
    gender: str
    risk_level: str = Field(..., alias="riskLevel")
    risk_score: float = Field(..., alias="riskScore")
    screening_date: str = Field(..., alias="screeningDate")
    status: str
    diagnosis: Optional[str] = None

    model_config = {"populate_by_name": True}


class ShapFeature(BaseModel):
    """Single SHAP feature contribution."""
    name: str
    value: float
    direction: str  # "positive" or "negative"


class ExplainResponse(BaseModel):
    """SHAP explanation response."""
    case_id: str = Field(..., alias="caseId")
    base_value: float = Field(..., alias="baseValue")
    output_value: float = Field(..., alias="outputValue")
    features: list[ShapFeature]

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    model_loaded: bool = Field(False, alias="modelLoaded")
    version: str = "1.0.0"

    model_config = {"populate_by_name": True}
