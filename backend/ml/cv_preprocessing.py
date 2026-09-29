"""
ml/cv_preprocessing.py — OpenCV-based facial frame preprocessing for NeuroSense.

This module is a deliberately small, single-responsibility pipeline that:
  1. Decodes a raw frame (bytes or numpy array)
  2. Runs face detection (Haar cascade or DNN — whichever is available)
  3. Crops to the detected face bounding box (or centre-crops if no face found)
  4. Converts to greyscale
  5. Resizes to a target resolution
  6. Applies CLAHE (contrast-limited adaptive histogram equalisation)
  7. Returns the preprocessed image as a numpy array AND a status dict

It does NOT contain any model inference logic.  It is called by
facial_engine.py before a frame is passed to the CNN.

Detector priority:
  1. OpenCV's built-in cv2.dnn face detector (res10_300x300_ssd — ships
     with OpenCV 4.x, most robust in varied lighting).
  2. Haar CascadeClassifier fallback (haarcascade_frontalface_default.xml,
     always bundled with OpenCV).
  3. Centre-crop last-resort (when no face is found but we must produce
     a tensor to avoid a total pipeline stall).

If opencv-python-headless is not installed the module degrades gracefully:
all functions return a result dict with `cv_available=False` and the
calling code in facial_engine.py falls back to PIL-only preprocessing.
"""

from __future__ import annotations

import io
from typing import Optional

import numpy as np

# ── Constants ────────────────────────────────────────────────────────────────
TARGET_SIZE: int = 128          # pixels — matches FacialCNN input (128×128)
CLAHE_CLIP_LIMIT: float = 2.0  # moderate contrast enhancement, no over-sharpening
CLAHE_TILE_GRID: tuple[int, int] = (8, 8)
MIN_FACE_CONFIDENCE: float = 0.5  # DNN detector threshold
_CENTRE_CROP_FRAC: float = 0.7   # fraction of shorter side to keep in centre-crop


# ── Lazy OpenCV import ───────────────────────────────────────────────────────

def _import_cv2():
    """Import cv2 lazily so the module loads cleanly when OpenCV is absent."""
    try:
        import cv2
        return cv2
    except ImportError:
        return None


# ── Public API ───────────────────────────────────────────────────────────────

def preprocess_frame(
    frame_input: "bytes | np.ndarray",
    target_size: int = TARGET_SIZE,
) -> dict:
    """Detect, crop, normalise, and return a preprocessed face image.

    Parameters
    ----------
    frame_input : bytes | np.ndarray
        Raw image bytes (JPEG/PNG/WebP) or an already-decoded BGR uint8
        numpy array (H, W, 3) as produced by cv2.imdecode.
    target_size : int
        Side length for the output square image (default 128).

    Returns
    -------
    dict with keys:
        ``image``        – (H, W) uint8 greyscale numpy array, or None on failure.
        ``face_found``   – bool, True when a face bounding box was detected.
        ``face_box``     – (x, y, w, h) tuple or None.
        ``detector``     – str label of which detector was used.
        ``cv_available`` – bool, False when OpenCV is not installed.
        ``status``       – str, one of "ok" | "no_face_centre_crop" | "decode_error" | "cv_unavailable".
    """
    cv2 = _import_cv2()
    if cv2 is None:
        return _unavailable_result()

    # ── Decode input ─────────────────────────────────────────────────────────
    if isinstance(frame_input, (bytes, bytearray)):
        arr = np.frombuffer(frame_input, dtype=np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            return _error_result("Frame bytes could not be decoded by OpenCV.")
    elif isinstance(frame_input, np.ndarray):
        bgr = frame_input.copy()
    else:
        return _error_result(f"Unsupported frame_input type: {type(frame_input)}")

    # ── Face detection ───────────────────────────────────────────────────────
    face_box, detector_label = _detect_face(cv2, bgr)
    face_found = face_box is not None

    if face_found:
        x, y, w, h = face_box
        # Add a 10% margin around the crop so ears/forehead are included
        margin_x = int(w * 0.10)
        margin_y = int(h * 0.10)
        x1 = max(0, x - margin_x)
        y1 = max(0, y - margin_y)
        x2 = min(bgr.shape[1], x + w + margin_x)
        y2 = min(bgr.shape[0], y + h + margin_y)
        crop = bgr[y1:y2, x1:x2]
        status = "ok"
    else:
        # Centre-crop fallback — keeps the pipeline moving
        crop = _centre_crop(bgr)
        face_box = None
        status = "no_face_centre_crop"
        detector_label = "centre_crop_fallback"

    # ── Greyscale + CLAHE normalisation ──────────────────────────────────────
    grey = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(grey, (target_size, target_size), interpolation=cv2.INTER_AREA)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID)
    normalised = clahe.apply(resized)

    return {
        "image": normalised,       # (128, 128) uint8 — greyscale, CLAHE-normalised
        "face_found": face_found,
        "face_box": tuple(face_box) if face_found else None,
        "detector": detector_label,
        "cv_available": True,
        "status": status,
    }


def preprocess_frame_to_tensor(
    frame_input: "bytes | np.ndarray",
    target_size: int = TARGET_SIZE,
) -> dict:
    """Convenience wrapper that also returns a torch tensor (1, 1, H, W) float32.

    The tensor is normalised to [0, 1] from the uint8 greyscale array.
    Returns None for the tensor key when OpenCV or torch is unavailable.
    """
    result = preprocess_frame(frame_input, target_size)

    if result["image"] is None:
        result["tensor"] = None
        return result

    try:
        import torch
        arr = result["image"].astype(np.float32) / 255.0          # [0, 1]
        tensor = torch.tensor(arr, dtype=torch.float32)
        tensor = tensor.unsqueeze(0).unsqueeze(0)                  # (1, 1, H, W)
        result["tensor"] = tensor
    except ImportError:
        result["tensor"] = None

    return result


# ── Face detectors ───────────────────────────────────────────────────────────

def _detect_face(
    cv2,
    bgr: np.ndarray,
) -> tuple[Optional[tuple[int, int, int, int]], str]:
    """Try DNN detector first, then Haar cascade.

    Returns
    -------
    (face_box, detector_label) where face_box is (x, y, w, h) or None.
    """
    # 1. Try DNN detector (res10_300x300_ssd — most robust)
    result = _detect_dnn(cv2, bgr)
    if result is not None:
        return result, "cv2_dnn_res10"

    # 2. Try Haar cascade fallback
    result = _detect_haar(cv2, bgr)
    if result is not None:
        return result, "haar_frontalface"

    return None, "none"


def _detect_dnn(cv2, bgr: np.ndarray) -> Optional[tuple[int, int, int, int]]:
    """Face detection via OpenCV's built-in DNN face model (res10_300x300_ssd).

    OpenCV 4.x ships this model inside its data directory.  We locate it
    at runtime rather than bundling our own copy.
    """
    try:
        # Locate OpenCV data directory (cross-platform)
        data_dir = cv2.data.haarcascades.replace("haarcascades/", "")
        prototxt = data_dir + "dnn/face_detector/deploy.prototxt"
        caffemodel = data_dir + "dnn/face_detector/res10_300x300_ssd_iter_140000.caffemodel"

        import os
        if not os.path.exists(prototxt) or not os.path.exists(caffemodel):
            return None  # DNN model files not present; fall through to Haar

        net = cv2.dnn.readNetFromCaffe(prototxt, caffemodel)
        h, w = bgr.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(bgr, (300, 300)), 1.0, (300, 300),
            (104.0, 177.0, 123.0), swapRB=False,
        )
        net.setInput(blob)
        detections = net.forward()

        best_conf, best_box = 0.0, None
        for i in range(detections.shape[2]):
            conf = float(detections[0, 0, i, 2])
            if conf > MIN_FACE_CONFIDENCE and conf > best_conf:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x1, y1, x2, y2 = box.astype(int)
                best_conf = conf
                best_box = (int(x1), int(y1), int(x2 - x1), int(y2 - y1))

        return best_box
    except Exception:
        return None


def _detect_haar(cv2, bgr: np.ndarray) -> Optional[tuple[int, int, int, int]]:
    """Face detection via Haar CascadeClassifier (always present with OpenCV)."""
    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(
            grey,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )
        if len(faces) == 0:
            return None
        # Return the largest detected face
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        return (int(x), int(y), int(w), int(h))
    except Exception:
        return None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _centre_crop(bgr: np.ndarray) -> np.ndarray:
    """Centre-crop the image to a square fraction of its shorter side."""
    h, w = bgr.shape[:2]
    side = int(min(h, w) * _CENTRE_CROP_FRAC)
    y_start = (h - side) // 2
    x_start = (w - side) // 2
    return bgr[y_start: y_start + side, x_start: x_start + side]


def _unavailable_result() -> dict:
    return {
        "image": None,
        "face_found": False,
        "face_box": None,
        "detector": "none",
        "cv_available": False,
        "status": "cv_unavailable",
    }


def _error_result(reason: str) -> dict:
    return {
        "image": None,
        "face_found": False,
        "face_box": None,
        "detector": "none",
        "cv_available": True,
        "status": f"decode_error: {reason}",
    }
