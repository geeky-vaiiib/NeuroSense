"""Pydantic models for the triple-track NeuroSense screening API."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

try:
    from ..ml import qchat10
    from ..ml.questionnaire_score import (SUPPORTED_FOR_NEW_SCREENINGS, normalise_answer,
                                          validate_age)
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml import qchat10
    from ml.questionnaire_score import SUPPORTED_FOR_NEW_SCREENINGS, normalise_answer, validate_age


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


# ── Modality breakdown ─────────────────────────────────────────────
class ModalityComponentResult(BaseModel):
    """Per-modality contribution exposed in the screening response."""
    modality: str = Field(..., description="questionnaire | gaze | speech")
    score: float = Field(..., ge=0.0, le=1.0)
    method: str = Field(
        ...,
        description="supervised_ml | rule_based_heuristic | lstm_trained | cnn_trained",
    )
    is_trained_model: bool = Field(
        ...,
        alias="isTrainedModel",
        description="True only when a trained ML checkpoint produced this score",
    )
    modality_label: str = Field(..., alias="modalityLabel")
    available: bool = Field(
        True,
        description="False when the step was skipped or data was insufficient",
    )

    weight: Optional[float] = Field(None, description="Fixed fusion weight of this modality")
    contribution: Optional[float] = Field(None, description="Share of the final probability (0 when supplemental/unavailable)")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class ModalityBreakdown(BaseModel):
    """Full per-modality breakdown from the fusion engine."""
    components: list[ModalityComponentResult] = Field(default_factory=list)
    modalities_used: int = Field(1, alias="modalitiesUsed")
    heuristic_signal: Optional[float] = Field(
        None,
        alias="heuristicSignal",
        description="Weighted average of available heuristic scores (supplemental only)",
    )
    confidence_note: str = Field(
        "",
        alias="confidenceNote",
        description="Plain-English disclosure of what drove the final probability",
    )

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


# ── Request ────────────────────────────────────────────────────────
class Demographics(BaseModel):
    subject_name: Optional[str] = Field(None, alias="subjectName", max_length=120)
    respondent_name: Optional[str] = Field(None, alias="respondentName", max_length=120)
    respondent_relationship: Optional[str] = Field(None, alias="respondentRelationship", max_length=80)
    age: Optional[int] = Field(
        None, ge=0, le=100,
        description="Age in years (adult/child). Toddlers: send ageMonths instead; years are derived by the server.",
    )
    age_months: Optional[int] = Field(
        None, alias="ageMonths", ge=0, le=300,
        description="Toddler (Q-CHAT-10) only: age in whole months, validated to 18-24 by the server",
    )
    gender: GenderEnum
    ethnicity: Optional[str] = Field(None, description="Ethnicity label", max_length=80)
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

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class AQ10Answers(BaseModel):
    """Ten AQ-10 answers. Each must be exactly one of the four response options (case-insensitive)."""
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

    @field_validator("A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", mode="before")
    @classmethod
    def _valid_option(cls, v):
        return normalise_answer(v)          # raises ValueError -> HTTP 422 naming the field


class StoredAnswers(BaseModel):
    """Answers as stored on a case (lenient: history is never rejected by newer validation rules).
    AQ-10 cases store A1..A10 (agree/disagree text); Q-CHAT-10 cases store Q1..Q10 (option letters A-E)."""
    model_config = ConfigDict(extra="allow")
    A1: Optional[str] = None
    A2: Optional[str] = None
    A3: Optional[str] = None
    A4: Optional[str] = None
    A5: Optional[str] = None
    A6: Optional[str] = None
    A7: Optional[str] = None
    A8: Optional[str] = None
    A9: Optional[str] = None
    A10: Optional[str] = None


class GazePoint(BaseModel):
    """A single gaze-coordinate sample from the frontend GazeSession."""
    x: float = Field(..., ge=0.0, le=1.0, description="Normalised horizontal position")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalised vertical position")
    timestamp: float = Field(..., description="Unix timestamp in milliseconds")
    stimulus: int = Field(..., ge=0, le=4, description="Active stimulus index (0–4)")


class ScreeningRequest(BaseModel):
    category: CategoryEnum = Field(..., description="adult, child, or toddler")
    demo: Demographics
    answers: dict = Field(
        ..., description="child/adult: A1..A10 each one of the four agree/disagree options; toddler: Q1..Q10 each one option letter A-E (Q-CHAT-10)")
    aq10_score: Optional[int] = Field(
        default=None,
        alias="aq10Score",
        description="IGNORED. Accepted only for backwards compatibility: the server always recomputes the total "
                    "from `answers`; a differing client value is reported as a warning, never used.",
    )
    gaze_points: Optional[list[GazePoint]] = Field(
        default=[],
        alias="gazePoints",
        description="DEPRECATED legacy normalised points; ignored. Use gazeSession.",
    )
    gaze_analysis_id: Optional[str] = Field(
        default=None,
        alias="gazeAnalysisId",
        max_length=64,
        description="Id of a completed /gaze/analyze job; the server looks up its own result",
    )
    gaze_skip_reason: Optional[str] = Field(
        default=None,
        alias="gazeSkipReason",
        pattern=r"^[a-z_]{1,48}$",
        description="Why the gaze step ended without a session (e.g. calibration_poor, camera_denied, user_skipped)",
    )
    gaze_skipped: Optional[bool] = Field(
        default=False,
        alias="gazeSkipped",
        description="True if the user explicitly skipped the gaze step",
    )
    audio_base64: Optional[str] = Field(
        default=None,
        alias="audioBase64",
        description="Base64-encoded speech audio from the recording step",
    )
    audio_mime_type: Optional[str] = Field(
        default="audio/webm",
        alias="audioMimeType",
        description="MIME type of the recorded audio",
    )
    transcript_hint: Optional[str] = Field(
        default="",
        alias="transcriptHint",
        description="Optional user-provided transcript of what was said",
    )
    speech_skipped: Optional[bool] = Field(
        default=False,
        alias="speechSkipped",
        description="True if the user explicitly skipped the speech step",
    )
    facial_image_base64: Optional[str] = Field(
        default=None,
        alias="facialImageBase64",
        description="Base64-encoded facial snapshot from the screening step",
    )
    facial_skipped: Optional[bool] = Field(
        default=False,
        alias="facialSkipped",
        description="True if the user explicitly skipped the facial step",
    )

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())

    @model_validator(mode="after")
    def validate_age_category(self):
        cat = self.category.value
        if cat not in SUPPORTED_FOR_NEW_SCREENINGS:
            raise ValueError(f"Unsupported category {cat!r}. Supported: {', '.join(SUPPORTED_FOR_NEW_SCREENINGS)}.")
        if cat == "toddler":
            if self.demo.age_months is None:
                raise ValueError("toddler screening requires demo.ageMonths (18-24)")
            qchat10.validate_age_months(self.demo.age_months)
            self.demo.age = self.demo.age_months // 12            # derived; the client value is not trusted
            try:
                self.answers = qchat10.validate_answers(self.answers)
            except qchat10.AnswerError as exc:
                raise ValueError(f"invalid Q-CHAT-10 answers: {exc}") from exc
        else:
            if self.demo.age is None:
                raise ValueError(f"{cat} screening requires demo.age")
            validate_age(cat, self.demo.age)
            self.answers = AQ10Answers(**self.answers).model_dump()       # strict validation, canonical option text
        return self


# ── Response ───────────────────────────────────────────────────────
class ScreeningResponse(BaseModel):
    case_id: str = Field(..., alias="caseId", description="Generated case identifier")
    category: CategoryEnum
    category_label: str = Field(..., alias="categoryLabel")
    status: str = Field("processing", description="Current processing status")
    risk_level: RiskLevel = Field(..., alias="riskLevel")
    fusion_score: Optional[float] = Field(
        None,
        alias="fusionScore",
        description="DEPRECATED, always null: there is no composite probability (see `result`).",
    )
    questionnaire_probability: Optional[float] = Field(
        None, ge=0.0, le=1.0, alias="questionnaireProbability",
        description="Output of the questionnaire ML model (null if none is loaded). It models the scoring rule, is not an "
                    "independently validated probability, and does not affect the result.",
    )
    questionnaire_basis: Optional[dict] = Field(
        None, alias="questionnaireBasis",
        description="Server-computed questionnaire score: total, threshold, band, per-item points, notice",
    )
    model_output: Optional[dict] = Field(None, alias="modelOutput", description="Questionnaire ML model output, labelled")
    result: dict = Field(default_factory=dict, description="Screening result from the central fusion contract")
    modalities: list[dict] = Field(default_factory=list, description="Per-modality status contract")
    warnings: list[str] = Field(default_factory=list)
    scoring_version: int = Field(2, alias="scoringVersion")
    heuristic_signal: Optional[float] = Field(None, alias="heuristicSignal", description="DEPRECATED, always null")
    confidence_note: str = Field("", alias="confidenceNote")
    modality_breakdown: Optional[ModalityBreakdown] = Field(None, alias="modalityBreakdown", description="DEPRECATED, null: use `modalities`")
    aq10_score: int = Field(..., alias="aq10Score", description="Server-computed total (the client value is ignored)")
    model_used: str = Field("", alias="modelUsed", description="Model identifier")
    is_mock: bool = Field(False, alias="isMock")
    data_source: str = Field(..., alias="dataSource")
    interpretation: str
    gaze_result: Optional[dict] = Field(
        None,
        alias="gazeResult",
        description="Backend gaze analysis: status, probability, model_version, quality (null if skipped)",
    )
    gaze_interpretation: Optional[str] = Field(
        None,
        alias="gazeInterpretation",
        description="Plain-English interpretation of gaze analysis results",
    )
    speech_interpretation: Optional[str] = Field(
        None,
        alias="speechInterpretation",
        description="Plain-English interpretation of speech analysis results",
    )
    facial_interpretation: Optional[str] = Field(
        None,
        alias="facialInterpretation",
        description="Plain-English interpretation of facial analysis results",
    )
    speech_flags: Optional[list[str]] = Field(
        None,
        alias="speechFlags",
        description="Clinical flags raised by speech analysis",
    )
    submitted_at: str = Field(..., alias="submittedAt")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class CaseSummaryResponse(BaseModel):
    id: str
    category: CategoryEnum
    category_label: str = Field(..., alias="categoryLabel")
    subject_name: Optional[str] = Field(None, alias="subjectName", max_length=120)
    respondent_name: Optional[str] = Field(None, alias="respondentName", max_length=120)
    respondent_relationship: Optional[str] = Field(None, alias="respondentRelationship", max_length=80)
    age: int
    gender: str
    risk_level: str = Field(..., alias="riskLevel")
    risk_score: Optional[float] = Field(None, alias="riskScore", description="Legacy model output of pre-v2 cases; null for server-scored cases")
    screening_date: str = Field(..., alias="screeningDate")
    status: str
    diagnosis: Optional[str] = None
    screening_tool: str = Field(..., alias="screeningTool")
    model_used: str = Field(..., alias="modelUsed")
    is_mock: bool = Field(..., alias="isMock")
    data_source: str = Field(..., alias="dataSource")
    tags: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class CaseDetailResponse(CaseSummaryResponse):
    referral_date: str = Field("", alias="referralDate")
    clinician: str = ""
    completed_screenings: list[str] = Field(default_factory=list, alias="completedScreenings")
    aq10_score: int = Field(..., alias="aq10Score")
    notes: str = ""
    interpretation: str
    demo: Demographics
    answers: StoredAnswers
    modality_breakdown: list[dict] = Field(default_factory=list)
    modalities_used: Optional[int] = None
    confidence_note: Optional[str] = None
    fusion_score: Optional[float] = None
    questionnaire_probability: Optional[float] = None
    questionnaire_basis: Optional[dict] = None
    questionnaire_model: Optional[dict] = None
    age_months: Optional[int] = None
    scoring_version: Optional[int] = None
    modality_states: Optional[list] = None
    screening_result: Optional[dict] = None
    warnings: Optional[list] = None
    # Gaze analysis (snake_case keys; all optional so pre-gaze-model cases still load)
    gaze_score: Optional[float] = None
    gaze_status: Optional[str] = None
    gaze_reason: Optional[str] = None
    gaze_model_version: Optional[str] = None
    gaze_quality: Optional[dict] = None
    gaze_features: Optional[dict] = None
    gaze_interpretation: Optional[str] = None
    gaze_analyzed_at: Optional[str] = None
    gaze_preprocessing_version: Optional[str] = None
    gaze_error_code: Optional[str] = None
    gaze_fusion_eligible: Optional[bool] = None
    gaze: Optional[dict] = None
    gaze_skipped: Optional[bool] = None
    gaze_mock: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


# ── Explainability ─────────────────────────────────────────────────
class ShapFeatureOut(BaseModel):
    feature: str
    shap_value: float = Field(..., alias="shapValue")
    direction: str

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class LimeFeatureOut(BaseModel):
    feature: str
    weight: float
    direction: str
    plain_english: str = Field(..., alias="plainEnglish")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class CombinedExplainResponse(BaseModel):
    case_id: str = Field(..., alias="caseId")
    category: CategoryEnum
    category_label: str = Field(..., alias="categoryLabel")
    model_used: str = Field("", alias="modelUsed")
    is_mock: bool = Field(False, alias="isMock")
    data_source: str = Field(..., alias="dataSource")
    shap: list[ShapFeatureOut] = Field(default_factory=list)
    lime: list[LimeFeatureOut] = Field(default_factory=list)
    summary: str = Field(..., description="Plain-language overall explanation")
    generated_at: str = Field(..., alias="generatedAt")
    scoring_version: Optional[int] = Field(None, alias="scoringVersion")
    score_explanation: Optional[dict] = Field(
        None, alias="scoreExplanation",
        description="How the questionnaire total was formed (per-item points). This explains the RESULT.")
    model_explanation: dict = Field(
        default_factory=dict, alias="modelExplanation",
        description="SHAP/LIME status and scope. These explain the questionnaire ML model's output (a model of the scoring "
                    "rule), NOT the screening result and NOT any gaze/speech/facial measurement.")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class CategoryCountResponse(BaseModel):
    category: CategoryEnum
    label: str
    count: int


class DashboardTotalsResponse(BaseModel):
    total_cases: int = Field(..., alias="totalCases")
    adult_cases: int = Field(..., alias="adultCases")
    child_cases: int = Field(..., alias="childCases")
    high_risk: int = Field(..., alias="highRisk")
    moderate_risk: int = Field(..., alias="moderateRisk")
    low_risk: int = Field(..., alias="lowRisk")
    awaiting_review: int = Field(..., alias="awaitingReview")
    mock_cases: int = Field(..., alias="mockCases")
    average_risk_score: Optional[float] = Field(None, alias="averageRiskScore")
    average_aq10_score: float = Field(..., alias="averageAq10Score")
    toddler_cases: int = Field(0, alias="toddlerCases")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class DashboardSummaryResponse(BaseModel):
    category_filter: str = Field(..., alias="categoryFilter")
    totals: DashboardTotalsResponse
    recent_cases: list[CaseSummaryResponse] = Field(default_factory=list, alias="recentCases")
    category_breakdown: list[CategoryCountResponse] = Field(
        default_factory=list,
        alias="categoryBreakdown",
    )
    modality_status: list[dict] = Field(default_factory=list, alias="modalityStatus")

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


# ── Health ─────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    models_loaded: dict = Field(
        default_factory=dict,
        alias="modelsLoaded",
        description="Per-category model status",
    )
    modalities: dict = Field(
        default_factory=dict,
        description="Per-modality engine availability",
    )
    database: dict = Field(default_factory=dict, description="Connection status only (never the connection string)")
    version: str = "3.2.0"

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())
