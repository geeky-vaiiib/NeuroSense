"""
ml/preprocessor.py — Clean and encode screening input features for inference.

Transforms the raw ScreeningRequest into a feature vector matching
the training pipeline's expectations.
"""

from typing import Optional

import numpy as np
import joblib
import os

# ASD-trait questions — agree variants score 1
ASD_TRAIT_IDS = {"A1", "A7", "A8", "A10"}

ANSWER_MAP = {
    "Definitely agree": 1,
    "Slightly agree": 1,
    "Definitely disagree": 0,
    "Slightly disagree": 0,
}

GENDER_MAP = {
    "Male": 1,
    "Female": 0,
    "Non-binary": 2,
    "Prefer not to say": 3,
}


def encode_aq10_scores(answers: dict) -> list[int]:
    """
    Convert AQ-10 answers to binary scores (0 or 1).
    For ASD-trait questions (A1, A7, A8, A10): agree = 1
    For non-trait questions: disagree = 1
    """
    scores = []
    for i in range(1, 11):
        key = f"A{i}"
        raw = answers.get(key, "Slightly disagree")
        is_agree = ANSWER_MAP.get(raw, 0)
        if key in ASD_TRAIT_IDS:
            scores.append(is_agree)
        else:
            scores.append(1 - is_agree)
    return scores


def preprocess_for_inference(demo: dict, answers: dict, encoders: Optional[dict] = None) -> np.ndarray:
    """
    Build the feature vector from demographics + AQ-10 answers.

    Feature order (must match training):
      [A1_Score, A2_Score, ..., A10_Score, age, gender, jaundice, family_asd, ethnicity]

    Returns: np.ndarray of shape (1, 15)
    """
    # AQ-10 binary scores
    aq_scores = encode_aq10_scores(answers)

    # Age
    age = int(demo.get("age", 25))

    # Gender
    gender_raw = demo.get("gender", "Prefer not to say")
    gender = GENDER_MAP.get(gender_raw, 3)

    # Jaundice
    jaundice = 1 if demo.get("jaundice") == "Yes" else 0

    # Family history
    family_asd = 1 if demo.get("familyAsd", demo.get("family_asd")) == "Yes" else 0

    # Ethnicity — use label encoder if available, else default to 0
    ethnicity_raw = demo.get("ethnicity", "Other")
    if encoders and "ethnicity" in encoders:
        try:
            ethnicity = int(encoders["ethnicity"].transform([ethnicity_raw])[0])
        except (ValueError, KeyError):
            ethnicity = 0
    else:
        ethnicity = 0

    features = aq_scores + [age, gender, jaundice, family_asd, ethnicity]
    return np.array(features, dtype=np.float64).reshape(1, -1)
