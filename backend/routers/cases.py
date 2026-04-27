"""
routers/cases.py — GET /cases and GET /cases/{id} endpoints.

Returns mock case data for the frontend dashboard and case history pages.
"""

from fastapi import APIRouter, HTTPException
from schemas.screening import CaseOut
from datetime import datetime

router = APIRouter(prefix="/cases", tags=["Cases"])

# ── Mock case store ────────────────────────────────────────────────
MOCK_CASES = [
    {
        "id": "NS-2024-001", "patientName": "Jordan A.", "age": 34,
        "gender": "Non-binary", "riskLevel": "High", "riskScore": 0.87,
        "screeningDate": "2024-11-14", "status": "reviewed",
        "diagnosis": "ASD — Confirmed",
    },
    {
        "id": "NS-2024-002", "patientName": "Sam T.", "age": 28,
        "gender": "Male", "riskLevel": "Moderate", "riskScore": 0.63,
        "screeningDate": "2024-11-13", "status": "pending-review",
        "diagnosis": "ADHD-Combined — Probable",
    },
    {
        "id": "NS-2024-003", "patientName": "Riley M.", "age": 22,
        "gender": "Female", "riskLevel": "Moderate", "riskScore": 0.58,
        "screeningDate": "2024-11-11", "status": "reviewed",
        "diagnosis": "Dyslexia — Confirmed",
    },
    {
        "id": "NS-2024-004", "patientName": "Alex K.", "age": 41,
        "gender": "Male", "riskLevel": "Low", "riskScore": 0.18,
        "screeningDate": "2024-11-07", "status": "closed",
        "diagnosis": "Low Risk — No Diagnosis",
    },
    {
        "id": "NS-2024-005", "patientName": "Morgan L.", "age": 19,
        "gender": "Female", "riskLevel": "High", "riskScore": 0.91,
        "screeningDate": "2024-11-17", "status": "in-progress",
        "diagnosis": "ASD + ADHD — Under Review",
    },
]


@router.get("/", response_model=list[CaseOut])
async def list_cases():
    """Return all mock cases."""
    return MOCK_CASES


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(case_id: str):
    """Return a single case by ID."""
    for case in MOCK_CASES:
        if case["id"] == case_id:
            return case
    raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
