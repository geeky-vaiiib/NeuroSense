"""Immutable saved presentation contract; clients render text, never derive decisions."""
from typing import Any, Literal
from pydantic import BaseModel, Field
try:
    from ..core.recording_contract import RecordingAnalysis
except ImportError:
    from core.recording_contract import RecordingAnalysis

class ReportValue(BaseModel):
    name: str
    value: Any = None
    unit: str | None = None
    text: str
    accessible_label: str | None = None
    display_label: str | None = None

class ReportModality(BaseModel):
    id: str
    label: str
    status: str
    status_label: str
    output: dict | None = None
    model: dict | None = None
    quality: dict | None = None
    measurements: dict | None = None
    included_in_screening: bool = False
    inclusion_reason: str
    limitations: list[str] = Field(default_factory=list)
    values: list[ReportValue] = Field(default_factory=list)

class RecordingSummary(BaseModel):
    id: str
    label: str
    status: Literal['Analysed', 'Skipped', 'Could not analyse', 'Recording needs another attempt', 'Measurements available; model result unavailable']
    summary: str
    analysis: RecordingAnalysis | None = None

class PlainPresentation(BaseModel):
    version: Literal['plain-language-v1']
    category: str | None = None
    title: str
    outcome: str
    meaning: str
    next_step: str
    notice: str
    score_text: str
    threshold_text: str
    score_accessible_label: str
    instrument: str
    recordings: list[RecordingSummary]
    is_example: bool
    provenance_label: str
    provenance_note: str

class ResearchReport(BaseModel):
    report_version: str = 'research-report-v3'
    presentation: PlainPresentation | None = None
    case_id: str
    generated_at: str
    provenance: str = 'Live submission; server calculations'
    questionnaire: dict | None = None
    screening_conclusion: str
    summary: list[str]
    modalities: list[ReportModality]
    formatting: str = 'Numeric values: 3 decimals; class scores: 1 decimal percent, uncalibrated. Raw values retained.'
