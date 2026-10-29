"""Facial module: face detection and image-quality measurement only.

Implemented: face detection (OpenCV DNN or Haar cascade), face box geometry, brightness / sharpness.
NOT implemented: facial landmarks, expression recognition, and - above all - ASD classification.  No ASD-labelled
facial dataset exists in this repository.  The former "heuristic score" (derived from image brightness/contrast)
and the optional FER-2013 CNN path were removed: brightness is not evidence of anything about autism, and an
emotion-recognition model is a different task (and facial expression must never be read as evidence of autism).
The modality is therefore reported as ``model_unavailable`` with the genuine detection/quality measurements.
"""

from __future__ import annotations

import base64

import numpy as np

try:
    from . import cv_preprocessing as _cv
except ImportError:  # pragma: no cover
    from ml import cv_preprocessing as _cv

ERR_NO_IMAGE = "FACIAL_NO_IMAGE"
ERR_DECODE = "FACIAL_DECODE_FAILED"
ERR_NO_FACE = "FACIAL_NO_FACE"
ERR_NO_MODEL = "FACIAL_CLASSIFIER_UNAVAILABLE"
ERR_CV = "FACIAL_CV_UNAVAILABLE"


def _result(status, *, reason=None, code=None, features=None) -> dict:
    return {"modality": "facial", "status": status, "reason": reason, "error_code": code, "features": features or {},
            "output": None, "model": None,
            "interpretation": ("A face was detected and image quality was measured. No facial ASD classifier exists, so no "
                               "facial screening result is produced.") if status == "model_unavailable" else (reason or "")}


def analyze_face(image_base64: str) -> dict:
    """Detect a face and measure image quality.  Never returns a risk score."""
    if not image_base64:
        return _result("insufficient_data", reason="No facial image provided.", code=ERR_NO_IMAGE)
    try:
        payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw = base64.b64decode(payload, validate=True)
    except Exception:
        return _result("analysis_failed", reason="Image data could not be decoded.", code=ERR_DECODE)
    cv2 = _cv._import_cv2()
    if cv2 is None:
        return _result("analysis_failed", reason="OpenCV is not available for face detection.", code=ERR_CV)
    bgr = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        return _result("analysis_failed", reason="Image could not be decoded.", code=ERR_DECODE)
    grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    box, detector = _cv._detect_face(cv2, bgr)
    h, w = grey.shape
    feats = {"image_width": int(w), "image_height": int(h), "mean_brightness": round(float(grey.mean()), 1),
             "sharpness_laplacian_var": round(float(cv2.Laplacian(grey, cv2.CV_64F).var()), 1), "detector": detector,
             "face_detected": box is not None}
    if box is None:
        return _result("failed_quality", reason="No face was detected in the image.", code=ERR_NO_FACE, features=feats)
    x, y, bw, bh = (int(v) for v in box)
    feats.update({"face_box": [x, y, bw, bh], "face_area_fraction": round(bw * bh / float(w * h), 4),
                  "face_center_offset": [round((x + bw / 2) / w - 0.5, 3), round((y + bh / 2) / h - 0.5, 3)]})
    return _result("model_unavailable", reason="No validated facial ASD classifier is installed.", code=ERR_NO_MODEL, features=feats)
