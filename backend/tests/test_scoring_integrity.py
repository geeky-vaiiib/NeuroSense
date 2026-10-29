"""Server-authoritative questionnaire scoring: tampering, validation, consistency across response/case/results."""

import pytest

from backend.ml.questionnaire_score import (AnswerError, LABEL_RULE_THRESHOLD, TRAIT_AGREE_IDS, normalise_answer,
                                            risk_band, score_items, score_questionnaire)
from backend.tests.conftest import CSRF, answers_scoring, screening_body

PW = "correct-horse-9"


def _login(client, email="s@example.com"):
    client.post("/auth/register", json={"name": "S", "email": email, "password": PW})


# ── the scoring function itself ─────────────────────────────────────────────

@pytest.mark.parametrize("category,trait", [("child", {"A1", "A5", "A7", "A10"}), ("adult", {"A1", "A7", "A8", "A10"})])
def test_reverse_coded_items_per_instrument(category, trait):
    """Agree scores on the instrument's trait items; disagree scores on all others (independent expectation)."""
    assert set(TRAIT_AGREE_IDS[category]) == trait
    all_agree = {f"A{i}": "Slightly agree" for i in range(1, 11)}
    assert score_items(category, all_agree) == [1 if f"A{i}" in trait else 0 for i in range(1, 11)]
    all_disagree = {f"A{i}": "Definitely disagree" for i in range(1, 11)}
    assert score_items(category, all_disagree) == [0 if f"A{i}" in trait else 1 for i in range(1, 11)]


def test_adult_and_child_differ_exactly_on_items_5_and_8():
    ans = {f"A{i}": "Definitely agree" for i in range(1, 11)}
    diff = [i + 1 for i, (a, c) in enumerate(zip(score_items("adult", ans), score_items("child", ans))) if a != c]
    assert diff == [5, 8]


@pytest.mark.parametrize("bad", [None, "", "maybe", 3, "Agree", "definitely  agree"])
def test_invalid_answer_values_rejected(bad):
    ans = answers_scoring(5); ans["A3"] = bad
    with pytest.raises(AnswerError) as e:
        score_items("child", ans)
    assert "A3" in e.value.problems


def test_missing_answers_rejected_not_defaulted():
    ans = answers_scoring(5); del ans["A9"]; ans["A2"] = None
    with pytest.raises(AnswerError) as e:
        score_items("child", ans)
    assert set(e.value.problems) == {"A9", "A2"}


def test_answers_are_case_and_space_insensitive_but_canonical():
    assert normalise_answer("  DEFINITELY agree ") == "Definitely agree"


@pytest.mark.parametrize("category", ["child", "adult"])
@pytest.mark.parametrize("pts", range(0, 11))
def test_total_and_band_follow_the_threshold(category, pts):
    s = score_questionnaire(category, answers_scoring(pts, category))
    thr = LABEL_RULE_THRESHOLD[category]
    assert s["total_score"] == pts and s["threshold"] == thr and s["meets_threshold"] == (pts >= thr)
    assert s["risk_band"] == risk_band(category, pts) == ("High" if pts >= thr else "Moderate" if pts == thr - 1 else "Low")
    assert sum(i["points"] for i in s["items"]) == pts and s["validated_against_clinical_labels"] is False


# ── API: the client cannot decide the result ─────────────────────────────────

def test_client_total_and_tampered_fields_are_ignored(app_client):
    c = app_client(); _login(c)
    body = screening_body(points=2, aq10Score=10, riskLevel="High", fusionScore=0.99, questionnaireProbability=0.99,
                          risk_level="High", userId="someone-else", questionnaireBasis={"total_score": 10},
                          modalityStates=[{"id": "gaze", "in_result": True}], scoringVersion=99)
    r = c.post("/screening/screen", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["aq10Score"] == 2 and d["questionnaireBasis"]["total_score"] == 2
    assert d["riskLevel"] == "Low" and d["result"]["risk_level"] == "Low" and d["result"]["total_score"] == 2
    assert d["fusionScore"] is None and d["result"]["composite_probability"] is None and d["scoringVersion"] == 2
    assert any("differs from the server-computed total" in w for w in d["warnings"])
    assert d["result"]["modalities_in_result"] == ["questionnaire"]


def test_response_case_and_list_use_the_same_canonical_score(app_client):
    c = app_client(); _login(c)
    d = c.post("/screening/screen", json=screening_body(points=7)).json()
    case = c.get(f"/cases/{d['caseId']}").json()
    assert d["aq10Score"] == case["aq10Score"] == case["questionnaire_basis"]["total_score"] == case["screening_result"]["total_score"] == 7
    assert d["riskLevel"] == case["riskLevel"] == case["screening_result"]["risk_level"] == "High"
    assert case["scoring_version"] == 2 and case["fusion_score"] is None and case["riskScore"] is None
    listed = next(x for x in c.get("/cases/").json() if x["id"] == d["caseId"])
    assert listed["riskLevel"] == "High" and listed["riskScore"] is None


@pytest.mark.parametrize("patch,expect", [
    (lambda b: b["answers"].__setitem__("A4", "banana"), 422),
    (lambda b: b["answers"].pop("A4"), 422),
    (lambda b: b["answers"].__setitem__("A4", None), 422),
    (lambda b: b["demo"].__setitem__("age", 12), 422),          # child form is 4-11
    (lambda b: b["demo"].__setitem__("age", 3), 422),
    (lambda b: b.__setitem__("category", "toddler"), 422),     # Q-CHAT-10 needs a 5-point scale: refused
    (lambda b: b.__setitem__("category", "teen"), 422),
    (lambda b: b["demo"].__setitem__("gender", "x"), 422),
])
def test_invalid_payloads_are_rejected_before_anything_is_stored(app_client, patch, expect):
    c = app_client(); _login(c)
    body = screening_body(); patch(body)
    assert c.post("/screening/screen", json=body).status_code == expect
    assert c.get("/cases/").json() == []


def test_adult_category_requires_adult_age_and_uses_adult_scoring(app_client):
    c = app_client(); _login(c)
    assert c.post("/screening/screen", json=screening_body(category="adult", age=15)).status_code == 422
    r = c.post("/screening/screen", json=screening_body(points=9, category="adult", age=30))
    assert r.status_code == 200 and r.json()["aq10Score"] == 9 and r.json()["questionnaireBasis"]["instrument"].startswith("AQ-10 (adult)")


def test_unknown_gaze_analysis_id_is_rejected(app_client):
    c = app_client(); _login(c)
    assert c.post("/screening/screen", json=screening_body(gazeSkipped=False, gazeAnalysisId="nope")).status_code == 422


def test_historical_cases_are_readable_and_not_rewritten(app_client, mongo):
    """A pre-v2 record (no scoring_version, stale values, invalid answers, old child age) is returned as stored."""
    c = app_client(); _login(c)
    uid = c.get("/auth/me").json()["user_id"]
    mongo["cases"].insert_one({"id": "NS-OLD-1", "user_id": uid, "category": "child", "age": 15, "risk_level": "High",
                               "risk_score": 0.91, "fusion_score": 0.91, "questionnaire_probability": 0.91, "aq10_score": 9,
                               "answers": {"A1": "Definitely Agree", "A2": "garbage"}, "demo": {"age": 15, "gender": "Male"}})
    r = c.get("/cases/NS-OLD-1")
    assert r.status_code == 200
    d = r.json()
    assert d["category"] == "child" and d["age"] == 15 and d["riskLevel"] == "High" and d["fusion_score"] == 0.91
    assert d["scoring_version"] is None and d["answers"]["A2"] == "garbage" and d["aq10Score"] == 9
    assert mongo["cases"].find_one({"id": "NS-OLD-1"})["risk_level"] == "High"          # untouched in the database
