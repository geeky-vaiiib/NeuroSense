"""Facial module: face detection, image quality, and separate optional expression CNN.

Implemented: face detection (OpenCV DNN or Haar cascade), face box geometry, brightness / sharpness.
Optional: a separate adult research expression CNN (research_inference), never an ASD classifier.
NOT implemented: facial landmarks or ASD classification. No ASD-labelled
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


def analyze_face(image_base64: str, *, research_enabled: bool = False) -> dict:
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
    feats = {"image_width": int(w), "image_height": int(h), "mean_brightness": float(grey.mean()),
             "sharpness_laplacian_var": float(cv2.Laplacian(grey, cv2.CV_64F).var()), "detector": detector,
             "face_detected": box is not None}
    if box is None:
        return _result("failed_quality", reason="No face was detected in the image.", code=ERR_NO_FACE, features=feats)
    x, y, bw, bh = (int(v) for v in box)
    feats.update({"face_box": [x, y, bw, bh], "face_area_fraction": round(bw * bh / float(w * h), 4),
                  "face_center_offset": [round((x + bw / 2) / w - 0.5, 3), round((y + bh / 2) / h - 0.5, 3)]})
    # Live-input hygiene only; these are explicit engineering thresholds, not validated
    # expression accuracy boundaries. Training crop/CLAHE and frozen weights are unchanged.
    boxes = (_cv._detect_dnn(cv2, bgr, all_boxes=True) if detector == 'cv2_dnn_res10' else
             _cv._detect_haar(cv2, bgr, all_boxes=True))
    crop = grey[max(0,y):min(h,y+bh),max(0,x):min(w,x+bw)]
    quality = {'policy':'face-input-hygiene-v1', 'detected_face_count':len(boxes) if boxes is not None else None,
               'valid':False, 'reason':None}
    if not crop.size:
        quality['reason'] = 'Detected face bounds are outside the image.'
    else:
        resized = cv2.resize(crop,(64,64),interpolation=cv2.INTER_AREA)
        quality.update(face_brightness=float(resized.mean()), face_sharpness=float(cv2.Laplacian(resized,cv2.CV_64F).var()))
        if boxes is not None and len(boxes)>1:
            quality['reason'] = 'More than one face was detected. Capture only the intended adult operator.'
        elif quality['face_brightness']<20 or quality['face_brightness']>235:
            quality['reason'] = 'The detected face is too dark or overexposed. Use even lighting and capture again.'
        elif quality['face_sharpness']<10:
            quality['reason'] = 'The detected face lacks sharp detail. Hold the camera steady and capture again.'
        else:
            quality['valid'] = True
    if not quality['valid']:
        result = _result('failed_quality', reason=quality['reason'], code='FACIAL_INPUT_QUALITY',features=feats)
        result['quality'] = quality
        return result
    result = _result("model_unavailable", reason="No validated facial ASD classifier is installed.", code=ERR_NO_MODEL, features=feats)
    result["quality"] = quality
    if research_enabled:
        from .research_inference import face_expression
        result['expression_result'] = face_expression(bgr)
    return result
