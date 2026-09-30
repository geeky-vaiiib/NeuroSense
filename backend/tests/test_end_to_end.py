import pytest
from fastapi.testclient import TestClient

def test_full_pipeline_smoke(app_client):
    if True:
        client = app_client()
        client.post('/auth/register', json={'name': 'E2E', 'email': 'e2e@example.com', 'password': 'correct-horse-9'})
        payload = {
            "category": "adult",
            "demo": {
                "subjectName": "Test Subject",
                "respondentName": "Self",
                "respondentRelationship": "Self",
                "age": 30,
                "gender": "Non-binary",
                "jaundice": "No",
                "familyAsd": "No"
            },
            "answers": {
                "A1": "Definitely Agree",
                "A2": "Slightly Agree",
                "A3": "Definitely Disagree",
                "A4": "Slightly Disagree",
                "A5": "Definitely Agree",
                "A6": "Definitely Agree",
                "A7": "Definitely Agree",
                "A8": "Definitely Agree",
                "A9": "Definitely Agree",
                "A10": "Definitely Agree"
            },
            "aq10Score": 8,
            "gazePoints": [],
            "gazeSkipped": True,
            "audioBase64": "",
            "speechSkipped": True,
            "facialImageBase64": "",
            "facialSkipped": True
        }
        
        response = client.post("/screening/screen", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "caseId" in data
        assert "riskLevel" in data
        assert "fusionScore" in data
        assert "modalityBreakdown" in data
        assert "confidenceNote" in data
        
        # Verify that fusion correctly handled skipped modalities
        breakdown = data["modalityBreakdown"]["components"]
        assert len(breakdown) == 4, "Should have 4 modalities returned in breakdown"
        
        questionnaire = next(c for c in breakdown if c["modality"] == "questionnaire")
        assert questionnaire["isTrainedModel"] is True
        
        gaze = next(c for c in breakdown if c["modality"] == "gaze")
        assert gaze["available"] is False
        
        speech = next(c for c in breakdown if c["modality"] == "speech")
        assert speech["available"] is False
        
        facial = next(c for c in breakdown if c["modality"] == "facial")
        assert facial["available"] is False
