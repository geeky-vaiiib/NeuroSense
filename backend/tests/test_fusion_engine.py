"""Tests for genuine multimodal fusion engine."""
import pytest
from ml.fusion_engine import fuse

def test_all_heuristic():
    """Only questionnaire is trained, others are heuristic."""
    # Q: 0.8 (weight 0.40)
    # Others heuristic -> they don't affect final probability
    result = fuse(
        questionnaire_probability=0.8,
        gaze_result={"score": 0.6, "is_trained_model": False},
        speech_result={"score": 0.5, "is_trained_model": False},
        facial_result={"score": 0.7, "is_trained_model": False}
    )
    assert result.final_probability == 0.8
    # Heuristic average = (0.6*0.2 + 0.5*0.2 + 0.7*0.2) / 0.6 = 1.8/3 = 0.6
    assert result.heuristic_signal == pytest.approx(0.6)
    assert "driven exclusively by the trained questionnaire" in result.confidence_note
    assert "Supplemental heuristic signal" in result.confidence_note

def test_all_trained():
    """All 4 modalities are trained."""
    # Q=0.8(0.4), G=0.6(0.2), S=0.5(0.2), F=0.7(0.2)
    # Total weight = 1.0
    # Weighted avg = 0.8*0.4 + 0.6*0.2 + 0.5*0.2 + 0.7*0.2 = 0.32 + 0.12 + 0.10 + 0.14 = 0.68
    result = fuse(
        questionnaire_probability=0.8,
        gaze_result={"score": 0.6, "is_trained_model": True},
        speech_result={"score": 0.5, "is_trained_model": True},
        facial_result={"score": 0.7, "is_trained_model": True}
    )
    assert result.final_probability == pytest.approx(0.68)
    assert result.heuristic_signal is None
    assert "genuine multimodal fusion" in result.confidence_note
    assert "Gaze, Speech, Facial" in result.confidence_note

def test_mixed_trained_heuristic():
    """Q and Gaze are trained, Speech is heuristic, Facial is missing."""
    # Q=0.8(0.4), G=0.6(0.2)
    # Total weight = 0.6
    # Weighted avg = (0.8*0.4 + 0.6*0.2) / 0.6 = (0.32 + 0.12) / 0.6 = 0.44 / 0.6 = 0.7333
    result = fuse(
        questionnaire_probability=0.8,
        gaze_result={"score": 0.6, "is_trained_model": True},
        speech_result={"score": 0.5, "is_trained_model": False},
        facial_result=None
    )
    assert result.final_probability == pytest.approx(0.7333, abs=0.0001)
    # Heuristic average = 0.5
    assert result.heuristic_signal == 0.5
    assert "Gaze" in result.confidence_note
    
    # Check that it doesn't mention Speech as a trained model
    trained_list_idx = result.confidence_note.find("auxiliary models (")
    if trained_list_idx != -1:
        start_idx = trained_list_idx + len("auxiliary models (")
        end_idx = result.confidence_note.find(")", start_idx)
        trained_list = result.confidence_note[start_idx:end_idx]
        assert "Speech" not in trained_list

def test_some_missing():
    """Q is trained, Gaze is missing, Speech and Facial are trained."""
    # Q=0.8(0.4), S=0.5(0.2), F=0.7(0.2)
    # Total weight = 0.8
    # Weighted avg = (0.8*0.4 + 0.5*0.2 + 0.7*0.2) / 0.8 = (0.32 + 0.10 + 0.14) / 0.8 = 0.56 / 0.8 = 0.70
    result = fuse(
        questionnaire_probability=0.8,
        gaze_result=None,
        speech_result={"score": 0.5, "is_trained_model": True},
        facial_result={"score": 0.7, "is_trained_model": True}
    )
    assert result.final_probability == pytest.approx(0.70)
    assert result.heuristic_signal is None
    assert "Speech, Facial" in result.confidence_note
