"""The questionnaire result must be presented as what it is: a score-threshold rule reproduced by ML."""

from pathlib import Path

import pandas as pd
import pytest

from backend.ml.config import CATEGORY_MODEL_CONFIG
from backend.ml.questionnaire_score import LABEL_RULE_THRESHOLD, NOTICE, score_basis


def _csv(category):
    for p in CATEGORY_MODEL_CONFIG[category]["dataset_paths"]:
        if Path(p).exists():
            return pd.read_csv(p)
    pytest.skip(f"no {category} dataset")


@pytest.mark.parametrize("category", ["adult", "child", "toddler"])
def test_label_is_exactly_the_documented_threshold_on_the_item_total(category):
    """If this ever fails the data changed and questionnaire_score.LABEL_RULE_THRESHOLD must be revisited."""
    df = _csv(category)
    df.columns = df.columns.str.strip()
    items = [c for c in df.columns if c in [f"A{i}" for i in range(1, 11)] + [f"A{i}_Score" for i in range(1, 11)]]
    label_col = [c for c in df.columns if c.lower().startswith("class")][0]
    y = df[label_col].astype(str).str.strip().str.upper().isin(["YES", "1"]).astype(int)
    assert len(items) == 10
    assert (((df[items].sum(axis=1) >= LABEL_RULE_THRESHOLD[category]).astype(int)) == y).all()


def test_score_basis_contents():
    b = score_basis("child", {f"A{i}": "Definitely agree" for i in range(1, 11)})
    assert b["max_score"] == 10 and b["total_score"] == 4           # agree scores on A1, A5, A7, A10 only
    assert b["threshold"] == 7 and b["meets_threshold"] is False and b["validated_against_clinical_labels"] is False
    assert b["notice"] == NOTICE and "not an independently validated probability" in NOTICE


def test_screening_response_and_case_carry_the_basis(app_client):
    from backend.tests.conftest import screening_body
    c = app_client()
    c.post("/auth/register", json={"name": "Q", "email": "q@example.com", "password": "correct-horse-9"})
    r = c.post("/screening/screen", json=screening_body(points=6))
    assert r.status_code == 200, r.text
    body = r.json()
    basis = body["questionnaireBasis"]
    assert basis["validated_against_clinical_labels"] is False and basis["total_score"] == 6 == body["aq10Score"]
    case = c.get(f"/cases/{body['caseId']}").json()
    assert case["questionnaire_basis"]["threshold"] == 7 and case["questionnaire_basis"]["total_score"] == 6
