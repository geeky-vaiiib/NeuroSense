"""Full pipeline smoke test through the real API (score, result contract, modality states, persistence)."""

from backend.tests.conftest import screening_body


def test_full_pipeline_smoke(app_client):
    client = app_client()
    client.post("/auth/register", json={"name": "E2E", "email": "e2e@example.com", "password": "correct-horse-9"})
    body = screening_body(points=8, category="adult", age=30, audioBase64="", facialImageBase64="")
    r = client.post("/screening/screen", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["caseId"] and d["riskLevel"] == "High" and d["fusionScore"] is None
    states = {m["id"]: m for m in d["modalities"]}
    assert set(states) == {"questionnaire", "gaze", "speech", "facial"}
    assert states["questionnaire"]["in_result"] is True and states["questionnaire"]["status"] == "available_scoring_instrument"
    for mid in ("gaze", "speech", "facial"):
        assert states[mid]["status"] == "skipped" and states[mid]["in_result"] is False and states[mid]["output"] is None
    assert d["result"]["modalities_in_result"] == ["questionnaire"] and d["result"]["composite_probability"] is None
    stored = client.get(f"/cases/{d['caseId']}").json()
    assert [m["id"] for m in stored["modality_states"]] == ["questionnaire", "gaze", "speech", "facial"]
    assert stored["screening_result"] == d["result"]
