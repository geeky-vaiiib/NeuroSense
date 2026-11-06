"""Explicit, authenticated recorded examples. Never copied into live cases."""
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
try:
    from ..core.auth import CurrentUser, get_current_user
    from ..schemas.report import ResearchReport
except ImportError:
    from core.auth import CurrentUser, get_current_user
    from schemas.report import ResearchReport

router=APIRouter(prefix='/research',tags=['Recorded research examples'])
EXAMPLE=Path(__file__).resolve().parents[1]/'reports/research/recorded_demo_example.json'

@router.get('/recorded-example',response_model=ResearchReport)
def recorded_example(user: CurrentUser=Depends(get_current_user)):
    if not EXAMPLE.exists():raise HTTPException(503,'Recorded research example not installed. No live result substituted.')
    return ResearchReport.model_validate(json.loads(EXAMPLE.read_text()))
