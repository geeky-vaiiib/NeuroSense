"""The central result contract: only the questionnaire score decides; other modalities cannot leak in."""

import copy

import pytest

from backend.ml import modality_status as MS
from backend.ml.fusion_engine import FORMULA, FusionError, combine
from backend.ml.questionnaire_score import score_questionnaire
from backend.tests.conftest import answers_scoring


def _screening(points=7, category="child"):
    return score_questionnaire(category, answers_scoring(points, category))


def _gaze_ok(prob=0.99):
    return {"status": "success", "probability": prob, "model_version": "gaze-openface-dasd-v3", "dataset": "DASD",
            "quality": {"valid": True}, "fusion_eligible": True, "domain": {"status": "in_domain"}}


def _states(screening, gaze=None, speech=None, facial=None, skipped=False):
    return [MS.questionnaire_state(screening, None), MS.gaze_state(gaze, skipped, None),
            MS.speech_state(speech, skipped), MS.facial_state(facial, skipped)]


def test_result_is_the_questionnaire_score_only():
    s = _screening(7)
    r = combine(s, _states(s))
    assert r["risk_level"] == "High" and r["outcome"] == "at_or_above_threshold" and r["composite_probability"] is None
    assert r["weights"] is None and r["modalities_in_result"] == ["questionnaire"] and r["formula"] == FORMULA


@pytest.mark.parametrize("gaze_prob", [0.0, 0.01, 0.5, 0.99, 1.0])
def test_experimental_gaze_output_cannot_change_the_result_even_if_it_claims_eligibility(gaze_prob):
    s = _screening(3)
    baseline = combine(s, _states(s))
    with_gaze = combine(s, _states(s, gaze=_gaze_ok(gaze_prob)))
    assert with_gaze["risk_level"] == baseline["risk_level"] == "Low"
    assert with_gaze["modalities_in_result"] == ["questionnaire"]
    g = next(x for x in with_gaze["excluded"] if x["id"] == "gaze")
    assert g["status"] == "available_experimental"


def test_unavailable_modalities_are_never_scored_as_zero():
    s = _screening(7)
    states = _states(s, gaze={"status": "insufficient_quality", "reason": "face_not_detected", "quality": {}},
                     speech={"status": "model_unavailable", "features": {"pitch_mean": 1.0}},
                     facial={"status": "failed_quality", "reason": "no face", "features": {}})
    r = combine(s, states)
    by = {m["id"]: m for m in states}
    assert by["gaze"]["status"] == "failed_quality" and by["speech"]["status"] == "model_unavailable"
    for m in states[1:]:
        assert m["output"] is None and m["in_result"] is False
    assert r["risk_level"] == "High"


def test_modality_status_mapping():
    g = lambda **k: MS.gaze_state({"status": "unavailable", **k}, False, None)["status"]
    assert g(error_code="GAZE_MODEL_MISSING") == "model_unavailable"
    assert g(error_code="GAZE_OPENFACE_UNAVAILABLE") == "analysis_failed"
    assert MS.gaze_state({"status": "out_of_domain", "reason": "x"}, False, None)["status"] == "failed_quality"
    assert MS.gaze_state(None, True, "user_skipped")["status"] == "skipped"
    assert MS.gaze_state(None, False, None)["status"] == "not_provided"
    assert MS.speech_state({"status": "insufficient_data"}, False)["status"] == "insufficient_data"
    assert MS.speech_state({"status": "garbage"}, False)["status"] == "analysis_failed"


def test_no_modality_other_than_the_questionnaire_is_ever_eligible():
    for st in MS.STATUS_LABELS:
        for mid in ("gaze", "speech", "facial"):
            assert MS._state(mid, mid, st)["eligible_for_result"] is False
    assert MS._state("questionnaire", "q", MS.AVAILABLE_SCORING)["eligible_for_result"] is True
    assert MS._state("questionnaire", "q", MS.AVAILABLE_EXPERIMENTAL)["eligible_for_result"] is False


def test_missing_questionnaire_state_and_multiple_eligible_modalities_are_refused(monkeypatch):
    s = _screening()
    with pytest.raises(FusionError):
        combine(s, [MS.gaze_state(None, True, None)])
    monkeypatch.setattr(MS, "ELIGIBLE_MODALITIES", frozenset({"questionnaire", "gaze"}))
    import backend.ml.fusion_engine as fe
    monkeypatch.setattr(fe, "ELIGIBLE_MODALITIES", frozenset({"questionnaire", "gaze"}))
    monkeypatch.setattr(fe, "ELIGIBLE_STATUSES", frozenset({MS.AVAILABLE_SCORING, MS.AVAILABLE_EXPERIMENTAL}))
    states = _states(s, gaze=_gaze_ok())
    states[1]["status"] = MS.AVAILABLE_EXPERIMENTAL
    with pytest.raises(FusionError):            # no combination rule exists; the engine does not invent one
        combine(s, states)


def test_combine_does_not_mutate_scores_and_is_deterministic():
    s = _screening(6)
    before = copy.deepcopy(s)
    a, b = combine(s, _states(s)), combine(s, _states(s))
    assert s == before and a == b and a["risk_level"] == "Moderate"


def test_api_ignores_a_gaze_result_that_claims_fusion_eligibility(app_client, monkeypatch):
    """Even a stored gaze job with fusion_eligible=True cannot enter the result; the stored case says so."""
    import backend.routers.screening as scr
    from backend.tests.conftest import screening_body
    monkeypatch.setattr(scr.gaze_jobs, "result_for", lambda jid, uid: _gaze_ok(0.999))
    c = app_client()
    c.post("/auth/register", json={"name": "F", "email": "f@example.com", "password": "correct-horse-9"})
    low = c.post("/screening/screen", json=screening_body(points=1, gazeSkipped=False, gazeAnalysisId="job1")).json()
    assert low["riskLevel"] == "Low" and low["result"]["modalities_in_result"] == ["questionnaire"]
    g = next(m for m in low["modalities"] if m["id"] == "gaze")
    assert g["status"] == "available_experimental" and g["in_result"] is False and g["eligible_for_result"] is False
    case = c.get(f"/cases/{low['caseId']}").json()
    assert case["gaze_fusion_eligible"] is False
