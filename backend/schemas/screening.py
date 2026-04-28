"""Pydantic models for the triple-track NeuroSense screening API."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

try:
    from ..core.categories import validate_age_for_category
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from core.categories import validate_age_for_category


# ── Enums ──────────────────────────────────────────────────────────
class CategoryEnum(str, Enum):
    adult   = "adult"
    child   = "child"
    toddler = "toddler"


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
    subject_name: Optional[str] = Field(None, alias="subjectName")
    respondent_name: Optional[str] = Field(None, alias="respondentName")
    respondent_relationship: Optional[str] = Field(None, alias="respondentRelationship")
    age: int = Field(
        ..., ge=0, le=100,
        description="Age in years for adult/child, or age in months if category is toddler",
    )
    gender: GenderEnum
    ethnicity: Optional[str] = Field(None, description="Ethnicity label")
    jaundice: Optional[JaundiceEnum] = Field(None, description="Jaundice at birth")
    family_asd: Optional[FamilyAsdEnum] = Field(
        None,
        alias="familyAsd",
        description="Family history of ASD",
    )
    age_unit: Optional[str] = Field(
        None,
        alias="ageUnit",
        description="'months' for toddler, 'years' for others",
    )

    model_config = ConfigDict(populate_by_name=True)


class AQ10Answers(BaseModel):
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
    category: CategoryEnum = Field(..., description="adult, child, or toddler")
    demo: Demographics
    answers: AQ10Answers
    aq10_score: int = Field(
        ...,
        ge=0,
        le=10,
        alias="aq10Score",
        description="Pre-computed AQ-10 / Q-CHAT-10 sum score",
    )

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_age_category(self):
        # Toddler age validation is handled differently (age may be in months)
        if self.category.value != "toddler":
            validate_age_for_category(self.category.value, self.demo.age)
        return self


# ── Response ───────────────────────────────────────────────────────
class ScreeningResponse(BaseModel):
    case_id: str = Field(..., alias="caseId", description="Generated case identifier")
    category: CategoryEnum
    category_label: str = Field(..., alias="categoryLabel")
    status: str = Field("processing", description="Current processing status")
    risk_level: RiskLevel = Field(..., alias="riskLevel")
    fusion_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        alias="fusionScore",
        description="Ensemble fusion probability",
    )
    aq10_score: int = Field(..., alias="aq10Score")
    model_used: str = Field("", alias="modelUsed", description="Model identifier")
    is_mock: bool = Field(False, alias="isMock")
    data_source: str = Field(..., alias="dataSource")
    interpretation: str
    submitted_at: str = Field(..., alias="submittedAt")

    model_config = ConfigDict(populate_by_name=True)


class CaseSummaryResponse(BaseModel):
    id: str
    category: CategoryEnum
    category_label: str = Field(..., alias="categoryLabel")
    subject_name: Optional[str] = Field(None, alias="subjectName")
    respondent_name: Optional[str] = Field(None, alias="respondentName")
    respondent_relationship: Optional[str] = Field(None, alias="respondentRelationship")
    age: int
    gender: str
    risk_level: str = Field(..., alias="riskLevel")
    risk_score: float = Field(..., alias="riskScore")
    screening_date: str = Field(..., alias="screeningDate")
    status: str
    diagnosis: Optional[str] = None
    screening_tool: str = Field(..., alias="screeningTool")
    model_used: str = Field(..., alias="modelUsed")
    is_mock: bool = Field(..., alias="isMock")
    data_source: str = Field(..., alias="dataSource")
    tags: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class CaseDetailResponse(CaseSummaryResponse):
    referral_date: str = Field("", alias="referralDate")
    clinician: str = ""
    completed_screenings: list[str] = Field(default_factory=list, alias="completedScreenings")
    aq10_score: int = Field(..., alias="aq10Score")
    notes: str = ""
    interpretation: str
    demo: Demographics
    answers: AQ10Answers

    model_config = ConfigDict(populate_by_name=True)


# ── Explainability ─────────────────────────────────────────────────
class ShapFeatureOut(BaseModel):
    feature: str
    shap_value: float = Field(..., alias="shapValue")
    direction: str

    model_config = ConfigDict(populate_by_name=True)


class LimeFeatureOut(BaseModel):
    feature: str
    weight: float
    direction: str
    plain_english: str = Field(..., alias="plainEnglish")

    model_config = ConfigDict(populate_by_name=True)


class CombinedExplainResponse(BaseModel):
    case_id: str = Field(..., alias="caseId")
    category: CategoryEnum
    category_label: str = Field(..., alias="categoryLabel")
    model_used: str = Field("", alias="modelUsed")
    is_mock: bool = Field(False, alias="isMock")
    data_source: str = Field(..., alias="dataSource")
    shap: list[ShapFeatureOut]
    lime: list[LimeFeatureOut]
    summary: str = Field(..., description="Plain-language overall explanation")
    generated_at: str = Field(..., alias="generatedAt")

    model_config = ConfigDict(populate_by_name=True)


class CategoryCountResponse(BaseModel):
    category: CategoryEnum
    label: str
    count: int


class ModalityConfidenceResponse(BaseModel):
    id: str
    label: str
    pct: int


class DashboardTotalsResponse(BaseModel):
    total_cases: int = Field(..., alias="totalCases")
    adult_cases: int = Field(..., alias="adultCases")
    child_cases: int = Field(..., alias="childCases")
    high_risk: int = Field(..., alias="highRisk")
    moderate_risk: int = Field(..., alias="moderateRisk")
    low_risk: int = Field(..., alias="lowRisk")
    awaiting_review: int = Field(..., alias="awaitingReview")
    mock_cases: int = Field(..., alias="mockCases")
    average_risk_score: float = Field(..., alias="averageRiskScore")
    average_aq10_score: float = Field(..., alias="averageAq10Score")
    toddler_cases: int = Field(0, alias="toddlerCases")

    model_config = ConfigDict(populate_by_name=True)


class DashboardSummaryResponse(BaseModel):
    category_filter: str = Field(..., alias="categoryFilter")
    totals: DashboardTotalsResponse
    recent_cases: list[CaseSummaryResponse] = Field(default_factory=list, alias="recentCases")
    category_breakdown: list[CategoryCountResponse] = Field(
        default_factory=list,
        alias="categoryBreakdown",
    )
    modality_confidence: list[ModalityConfidenceResponse] = Field(
        default_factory=list,
        alias="modalityConfidence",
    )

    model_config = ConfigDict(populate_by_name=True)


# ── Health ─────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    models_loaded: dict = Field(
        default_factory=dict,
        alias="modelsLoaded",
        description="Per-category model status",
    )
    version: str = "2.0.0"

    model_config = ConfigDict(populate_by_name=True)
