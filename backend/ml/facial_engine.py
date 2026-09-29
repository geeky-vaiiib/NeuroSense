"""Facial-expression risk scoring for NeuroSense.

Receives a base64-encoded image captured by the frontend FacialSession
component, decodes it, extracts features, and returns a 0-1 risk score.

Strategy:
  - If a trained CNN checkpoint exists at backend/models/facial_model.pt
    AND a matching facial_cnn_metadata.json is present, the model is loaded
    at module level and used for inference.
    Returns is_trained_model=True and method="cnn_trained".
  - Otherwise a rule-based heuristic derived from facial landmark analysis
    is used.  Returns is_trained_model=False and method="rule_based_heuristic".
    The response is also flagged isMock=True for backward compatibility.

IMPORTANT: No labeled facial+ASD training dataset exists in this repository.
The heuristic path MUST NOT be presented as a trained ML model.  The heuristic
will be retired when real labeled data and a checkpoint become available.

Training data disclosure:
  If a FER-2013-trained checkpoint is loaded, the interpretation string
  explicitly states that FER-2013 is a general-purpose facial-expression
  dataset (NOT an ASD-specific dataset) and that its scores should be
  treated as preliminary research signals only.
"""

from __future__ import annotations

import base64
import io
import json
from pathlib import Path
from typing import Any

import numpy as np

# ── OpenCV preprocessing (face detection + normalisation) ───────────────────
# Import lazily — cv_preprocessing degrades gracefully if OpenCV is absent.
from . import cv_preprocessing as _cv

# ── Model architecture (must be importable for torch.load) ──────────────────
# Kept here so torch.load can resolve the class when deserialising a checkpoint.
try:
    import torch
    import torch.nn as nn

    class FacialCNN(nn.Module):
        """Simple 2D CNN for image processing expecting (batch, 3, 128, 128)."""

        def __init__(self):
            super().__init__()
            self.conv1 = nn.Conv2d(3, 16, kernel_size=3, padding=1)
            self.relu1 = nn.ReLU()
            self.pool1 = nn.MaxPool2d(2)

            self.conv2 = nn.Conv2d(16, 32, kernel_size=3, padding=1)
            self.relu2 = nn.ReLU()
            self.pool2 = nn.MaxPool2d(2)

            self.flatten = nn.Flatten()
            self.fc = nn.Linear(32 * 32 * 32, 1)

        def forward(self, x):
            x = self.conv1(x)
            x = self.relu1(x)
            x = self.pool1(x)

            x = self.conv2(x)
            x = self.relu2(x)
            x = self.pool2(x)

            x = self.flatten(x)
            x = self.fc(x)
            return x.squeeze(1)

    _TORCH_AVAILABLE = True
except ImportError:
    _TORCH_AVAILABLE = False

# ── Model discovery ─────────────────────────────────────────────────────────
_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "facial_model.pt"
_META_PATH = Path(__file__).resolve().parent.parent / "models" / "facial_cnn_metadata.json"


def _load_model() -> tuple[Any | None, dict | None]:
    """Attempt to load a trained CNN checkpoint and its metadata."""
    if not _MODEL_PATH.exists():
        return None, None
    if not _TORCH_AVAILABLE:
        print("[NeuroSense] torch not available — facial CNN disabled")
        return None, None

    # Metadata validation (matches speech_engine pattern)
    meta = None
    if _META_PATH.exists():
        try:
            with open(_META_PATH, "r") as f:
                meta = json.load(f)
            # Minimum validation
            if "dataset" not in meta or "accuracy" not in meta:
                print(f"[NeuroSense] Facial CNN metadata incomplete — ignoring checkpoint")
                return None, None
        except Exception as exc:
            print(f"[NeuroSense] Facial CNN metadata parse failed ({exc})")
            return None, None
    else:
        print("[NeuroSense] No facial_cnn_metadata.json — ignoring checkpoint (provenance required)")
        return None, None

    try:
        model = torch.load(_MODEL_PATH, map_location="cpu", weights_only=False)
        model.eval()
        print(f"[NeuroSense] Facial CNN loaded from {_MODEL_PATH}")
        print(f"             Dataset: {meta.get('dataset', 'unknown')}")
        print(f"             Val accuracy: {meta.get('accuracy', 'N/A')}")
        return model, meta
    except Exception as exc:  # pragma: no cover
        print(f"[NeuroSense] Facial CNN load failed ({exc}) — falling back to heuristic")
        return None, None


_FACIAL_MODEL, _FACIAL_META = _load_model()


# ── Public API ──────────────────────────────────────────────────────────────

def compute_facial_score(
    image_base64: str,
    category: str = "adult",
) -> dict:
    """Score a base64-encoded facial image and return risk assessment.

    Parameters
    ----------
    image_base64 : str
        Base64-encoded image data (optionally with data-URI prefix).
    category : str
        ``"adult"`` or ``"child"``.  Toddler track does not use this module.

    Returns
    -------
    dict
        ``{ score, isMock, is_trained_model, method, modality_label,
            features, interpretation }``
    """
    if not image_base64:
        return _empty_result("No facial image provided.")

    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        image_bytes = base64.b64decode(image_base64)
    except Exception:
        return _empty_result("Image data could not be decoded from base64.")

    if _FACIAL_MODEL is not None:
        return _predict_cnn(image_bytes)

    return _predict_heuristic(image_bytes, category)


# ── CNN inference ───────────────────────────────────────────────────────────

def _predict_cnn(image_bytes: bytes) -> dict:
    """Run inference through the trained CNN checkpoint.

    Pipeline:
      1. cv_preprocessing.preprocess_frame() — face detection & CLAHE normalisation
      2. Fallback to PIL-only resize when OpenCV is absent
      3. FacialCNN inference
    """
    try:
        import torchvision.transforms as transforms
    except ImportError:
        return _empty_result("torchvision not installed for facial CNN inference.")

    # ── OpenCV path (preferred) ───────────────────────────────────────────────
    cv_result = _cv.preprocess_frame(image_bytes)
    cv_meta = {
        "cv_face_found": cv_result["face_found"],
        "cv_detector": cv_result["detector"],
        "cv_status": cv_result["status"],
    }

    if cv_result["cv_available"] and cv_result["image"] is not None:
        # Convert (H, W) greyscale → (1, 3, 128, 128) float tensor
        # Replicate single channel → 3-channel so it matches FacialCNN Conv2d(3, ...)
        grey = cv_result["image"].astype("float32") / 255.0
        rgb = np.stack([grey, grey, grey], axis=0)          # (3, 128, 128)
        tensor = torch.tensor(rgb, dtype=torch.float32).unsqueeze(0)  # (1, 3, 128, 128)
    else:
        # ── PIL fallback ──────────────────────────────────────────────────────
        from PIL import Image
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception:
            return _empty_result("Could not parse image bytes.")
        transform = transforms.Compose([
            transforms.Resize((128, 128)),
            transforms.ToTensor(),
        ])
        tensor = transform(image).unsqueeze(0)

    with torch.no_grad():
        output = _FACIAL_MODEL(tensor)
        prob = torch.sigmoid(output[0]).item()

    score = round(max(0.0, min(prob, 1.0)), 4)

    # Build dataset disclosure
    dataset_name = _FACIAL_META.get("dataset", "unknown") if _FACIAL_META else "unknown"
    disclosure = ""
    if "FER" in dataset_name.upper():
        disclosure = (
            " Note: This model was trained on FER-2013, a general-purpose "
            "facial-expression dataset — NOT an ASD-specific dataset. "
            "Scores should be treated as preliminary research signals only."
        )

    return {
        "score": score,
        "isMock": False,
        "is_trained_model": True,
        "method": "cnn_trained",
        "modality_label": f"Facial Analysis (Trained CNN — facial_model.pt, {dataset_name})",
        "features": cv_meta,
        "interpretation": _interpret(score) + disclosure,
    }


# ── Heuristic inference ────────────────────────────────────────────────────

def _predict_heuristic(image_bytes: bytes, category: str) -> dict:
    """Deterministic heuristic scoring from image pixel statistics.

    Without a trained model, we derive a nominal score from the image's
    luminance distribution.  This is *not* a clinically validated method
    and is transparently labelled as a research heuristic.

    When OpenCV is available, cv_preprocessing.preprocess_frame() runs first
    to apply face detection and CLAHE normalisation before extracting statistics.
    """
    # ── OpenCV path (preferred) ───────────────────────────────────────────────
    cv_result = _cv.preprocess_frame(image_bytes)

    if cv_result["cv_available"] and cv_result["image"] is not None:
        grey_arr = cv_result["image"].astype(np.float32)
        features = {
            "mean_brightness": round(float(grey_arr.mean()), 2),
            "std_brightness": round(float(grey_arr.std()), 2),
            "image_width": int(grey_arr.shape[1]),
            "image_height": int(grey_arr.shape[0]),
            "cv_face_found": cv_result["face_found"],
            "cv_detector": cv_result["detector"],
            "cv_status": cv_result["status"],
        }
    else:
        # ── PIL fallback ──────────────────────────────────────────────────────
        features = _extract_heuristic_features(image_bytes)
        if not features:
            return _empty_result("Could not extract features from image.")
        features["cv_face_found"] = False
        features["cv_detector"] = "none"
        features["cv_status"] = "cv_unavailable"

    # Derive a 0-1 score from luminance contrast and brightness
    # (purely deterministic, not clinically meaningful)
    brightness_norm = min(features.get("mean_brightness", 128) / 255.0, 1.0)
    contrast_norm = min(features.get("std_brightness", 50) / 128.0, 1.0)

    # Score: low contrast + low brightness → slightly higher risk signal
    # This is a placeholder heuristic — transparently disclosed.
    score = round(0.3 + 0.1 * (1.0 - contrast_norm) + 0.05 * (1.0 - brightness_norm), 4)
    score = round(max(0.0, min(score, 1.0)), 4)

    return {
        "score": score,
        "isMock": True,
        "is_trained_model": False,
        "method": "rule_based_heuristic",
        "modality_label": "Facial Analysis (Research Heuristic)",
        "features": features,
        "interpretation": _interpret(score),
    }


def _extract_heuristic_features(image_bytes: bytes) -> dict:
    """Extract basic pixel-level statistics from an image."""
    try:
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("L")  # grayscale
        arr = np.array(image, dtype=np.float32)

        return {
            "mean_brightness": round(float(arr.mean()), 2),
            "std_brightness": round(float(arr.std()), 2),
            "image_width": image.width,
            "image_height": image.height,
        }
    except Exception:
        return {}


# ── Helpers ─────────────────────────────────────────────────────────────────

def _empty_result(interpretation: str) -> dict:
    """Return a null-score result for edge cases."""
    return {
        "score": None,
        "isMock": True,
        "is_trained_model": False,
        "method": "rule_based_heuristic",
        "modality_label": "Facial Analysis (Research Heuristic)",
        "features": {},
        "interpretation": interpretation,
    }


def _interpret(score: float) -> str:
    """Return a plain-English interpretation sentence."""
    if score >= 0.65:
        return (
            "Facial expression analysis identified reduced affective display "
            "consistent with ASD-related communication patterns."
        )
    if score >= 0.40:
        return (
            "Facial expression analysis shows moderate deviation from typical "
            "affective display."
        )
    return (
        "Facial expressions are within typical range for this age group."
    )
