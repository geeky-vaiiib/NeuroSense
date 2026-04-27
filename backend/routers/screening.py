"""
routers/screening.py — POST /screen endpoint.

Accepts the full screening wizard payload, runs inference,
and returns a case ID + risk assessment.
"""

from fastapi import APIRouter, Request, HTTPException
from schemas.screening import ScreeningRequest, ScreeningResponse
from ml.model import predict
import uuid
from datetime import datetime

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("/screen", response_model=ScreeningResponse)
async def run_screening(body: ScreeningRequest, request: Request):
    """
    Submit a completed screening for ML inference.
    Returns risk level, fusion score, and a generated case ID.
    """
    model_bundle = request.app.state.model_bundle

    # Build dicts from Pydantic models
    demo_dict = {
        "age": body.demo.age,
        "gender": body.demo.gender.value,
        "jaundice": body.demo.jaundice.value if body.demo.jaundice else None,
        "familyAsd": body.demo.family_asd.value if body.demo.family_asd else None,
        "ethnicity": body.demo.ethnicity,
    }
    answers_dict = body.answers.model_dump()

    try:
        result = predict(model_bundle, demo_dict, answers_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    # Generate a case ID
    case_id = f"NS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    return ScreeningResponse(
        caseId=case_id,
        status="processing",
        riskLevel=result["risk_level"],
        fusionScore=result["probability"],
        aq10Score=body.aq10_score,
    )
