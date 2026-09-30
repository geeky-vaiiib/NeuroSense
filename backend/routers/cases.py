from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

try:
    from ..core.auth import CurrentUser, get_current_user
    from ..core.cases_store import case_detail, case_summary, dashboard_summary, get_case_record, list_case_records
    from ..schemas.screening import (
        CaseDetailResponse,
        CaseSummaryResponse,
        CategoryEnum,
        DashboardSummaryResponse,
    )
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from core.auth import CurrentUser, get_current_user
    from core.cases_store import case_detail, case_summary, dashboard_summary, get_case_record, list_case_records
    from schemas.screening import (
        CaseDetailResponse,
        CaseSummaryResponse,
        CategoryEnum,
        DashboardSummaryResponse,
    )

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    category: Optional[CategoryEnum] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    """Return category-aware dashboard aggregates."""
    return dashboard_summary(user.user_id, category.value if category else None)


@router.get("/", response_model=list[CaseSummaryResponse])
async def list_cases(
    category: Optional[CategoryEnum] = Query(None),
    user: CurrentUser = Depends(get_current_user),
):
    """Return cases, optionally filtered by category."""
    return [
        case_summary(record)
        for record in list_case_records(user.user_id, category.value if category else None)
    ]


@router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case(case_id: str, user: CurrentUser = Depends(get_current_user)):
    """Return a single case by ID."""
    record = get_case_record(case_id, user.user_id)   # someone else's case == not found
    if record is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_detail(record)
