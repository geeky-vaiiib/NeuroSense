"""Shared ML artifact and dataset configuration for adult/child model pipelines."""

from __future__ import annotations

from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ML_DIR.parent
DATA_DIR = BACKEND_DIR / "data"

FEATURE_NAMES = [
    "A1_Score",
    "A2_Score",
    "A3_Score",
    "A4_Score",
    "A5_Score",
    "A6_Score",
    "A7_Score",
    "A8_Score",
    "A9_Score",
    "A10_Score",
    "Age",
    "Gender",
    "Jaundice",
    "Family_ASD",
    "Ethnicity",
]

CATEGORY_MODEL_CONFIG = {
    "adult": {
        "label": "Adult",
        "dataset_paths": [
            DATA_DIR / "asd_screening_adult.csv",
            DATA_DIR / "asd_screening.csv",
        ],
        "model_path": ML_DIR / "model_adult.pkl",
        "encoders_path": ML_DIR / "encoders_adult.pkl",
        "background_path": ML_DIR / "background_adult.npy",
    },
    "child": {
        "label": "Child",
        "dataset_paths": [
            DATA_DIR / "asd_screening_child.csv",
        ],
        "model_path": ML_DIR / "model_child.pkl",
        "encoders_path": ML_DIR / "encoders_child.pkl",
        "background_path": ML_DIR / "background_child.npy",
    },
}

LEGACY_ADULT_ARTIFACTS = {
    "model_path": ML_DIR / "model.pkl",
    "encoders_path": ML_DIR / "encoders.pkl",
}
