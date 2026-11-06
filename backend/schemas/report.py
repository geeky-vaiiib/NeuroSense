"""Immutable saved presentation contract; clients render text, never derive decisions."""
from typing import Any
from pydantic import BaseModel, Field

class ReportValue(BaseModel):
    name: str
    value: Any = None
    unit: str | None = None
    text: str
    accessible_label: str | None = None

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

class ResearchReport(BaseModel):
    report_version: str = 'research-report-v1'
    case_id: str
    generated_at: str
    provenance: str = 'Live submission; server calculations'
    questionnaire: dict | None = None
    screening_conclusion: str
    summary: list[str]
    modalities: list[ReportModality]
    formatting: str = 'Numeric values: 3 decimals; class scores: 1 decimal percent, uncalibrated. Raw values retained.'
