"""Complete gaze analysis: OpenFace output / video -> quality -> preprocess -> model -> result."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from . import config as C
from . import inference as I
from . import model as M
from . import openface as OF
from . import preprocess as P
from . import quality as Q

WEBCAM_VALIDATION_PATH = M.MODELS_DIR / "gaze_openface_webcam_validation.json"
MIN_FUSION_CV_AUC = 0.70


class GazeService:
    def __init__(self, checkpoint: Path = M.CHECKPOINT_PATH, metadata: Path = M.METADATA_PATH,
                 validation: Path = WEBCAM_VALIDATION_PATH):
        self.model = None
        self.meta: dict = {}
        self.cfg: Optional[C.PreprocessConfig] = None
        self.load_error: Optional[tuple[str, str]] = None
        self.validation_path = validation
        try:
            self.model, self.meta = M.load_checkpoint(checkpoint, metadata)
            self.cfg = C.PreprocessConfig.from_dict(self.meta["preprocess_config"])
            if (self.cfg != C.DEPLOYED or self.meta.get("model_version") != C.MODEL_VERSION
                    or self.meta.get("feature_schema_version") != C.FEATURE_SCHEMA_VERSION):
                self.model = None
                self.load_error = (C.ERR_MODEL_MISMATCH, "checkpoint preprocessing differs from ml/gaze/config.py")
        except FileNotFoundError as exc:
            self.load_error = (C.ERR_MODEL_MISSING, str(exc))
        except Exception as exc:  # corrupt checkpoint
            self.load_error = (C.ERR_MODEL_MISSING, f"checkpoint failed to load: {exc}")

    # ── status ──
    @property
    def available(self) -> bool:
        return self.model is not None

    def webcam_validation(self) -> dict:
        try:
            return json.loads(Path(self.validation_path).read_text())
        except Exception:
            return {"passed": False, "reason": "no webcam domain validation has been run"}

    def fusion_eligibility(self) -> tuple[bool, str]:
        if not self.available:
            return False, "model unavailable"
        auc = self.meta.get("metrics", {}).get("cv_summary", {}).get("roc_auc", {}).get("mean")
        if auc is None or auc < MIN_FUSION_CV_AUC:
            return False, f"participant-level CV AUC below {MIN_FUSION_CV_AUC}"
        v = self.webcam_validation()
        if not v.get("passed"):
            return False, "webcam/OpenFace domain validation has not passed: " + str(v.get("reason", ""))
        return True, "ok"

    def status(self) -> dict:
        ok, why = self.fusion_eligibility()
        return {"available": self.available, "model_version": C.MODEL_VERSION, "dataset": C.DATASET_NAME,
                "openface_available": OF.is_available(), "fusion_eligible": ok, "fusion_reason": why,
                "error_code": None if self.available else self.load_error[0],
                "detail": None if self.available else self.load_error[1]}

    def health(self) -> dict:
        return self.status()

    def get_model_info(self) -> dict:
        return {**self.status(), "metadata": self.meta, "webcam_validation": self.webcam_validation()}

    # ── analysis ──
    def _base(self, session_id: Optional[str]) -> dict:
        return {"modality": "gaze", "dataset": C.DATASET_NAME, "model_version": C.MODEL_VERSION,
                "feature_schema_version": C.FEATURE_SCHEMA_VERSION, "session_id": session_id,
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "probability": None, "prediction": None, "score": None, "is_trained_model": False,
                "fusion_eligible": False, "isMock": False, "features": {}, "explanation": None,
                "method": "bilstm_openface_dasd",
                "modality_label": "Eye Gaze (OpenFace webcam model — DASD)",
                "error_code": None, "reason": None, "detail": None, "quality": None}

    def _fail(self, base: dict, status: str, code: str, reason: str, detail: str = "",
              quality: Optional[Q.QualityReport] = None) -> dict:
        base.update(status=status, model_status="available" if self.available else "unavailable",
                    error_code=code, reason=reason, detail=detail,
                    quality=quality.to_dict() if quality else None,
                    interpretation=f"Gaze could not be analysed ({reason}). It is treated as unavailable.")
        return base

    def analyze_frames(self, df: pd.DataFrame, session_id: Optional[str] = None) -> dict:
        """OpenFace dataframe -> result dict (the response contract)."""
        base = self._base(session_id)
        if not self.available:
            code, msg = self.load_error
            return self._fail(base, "unavailable", code, "model_unavailable", msg)
        try:
            prep = P.prepare_session(df, self.cfg)
        except P.SchemaError as exc:
            return self._fail(base, "unavailable", C.ERR_OPENFACE_FAILED, "openface_schema_mismatch", str(exc))
        q = Q.assess(prep)
        if not q.valid:
            return self._fail(base, "insufficient_quality", q.error_code, q.reason, quality=q)
        try:
            norm = self.meta["normalization"]
            wp = I.predict_windows(self.model, prep.windows, norm)
            prob = round(I.aggregate(wp), 4)
            ablation = I.feature_ablation(self.model, prep.windows, norm, self.cfg.feature_names, prob)
        except Exception as exc:
            return self._fail(base, "unavailable", C.ERR_INFERENCE, "inference_failed", str(exc), q)
        eligible, why = self.fusion_eligibility()
        pred = "asd_signal" if prob >= self.meta.get("decision_threshold", 0.5) else "typical_signal"
        base.update(
            status="success", model_status="available", probability=prob, prediction=pred, score=prob,
            is_trained_model=eligible, fusion_eligible=eligible, quality=q.to_dict(),
            features={"features_used": list(self.cfg.feature_names), "sequence_length": self.cfg.window_steps,
                      "sampling_rate_hz": self.cfg.resample_hz, "windows_scored": int(len(wp)),
                      "window_probability_min": round(float(wp.min()), 4),
                      "window_probability_max": round(float(wp.max()), 4)},
            explanation={"method": "feature ablation (replace one feature by its training mean, "
                                   "change in session probability)", "feature_effect": ablation},
            fusion_reason=why,
            interpretation=("The OpenFace-based gaze model produced a screening signal from this recording. "
                            "It reflects gaze/head-movement patterns learned from the DASD dataset and is "
                            "not a diagnosis."
                            + ("" if eligible else " It is shown for information and not yet counted in the "
                               "combined result (" + why + ").")))
        return base

    def analyze_video(self, video: Path, duration_s: Optional[float] = None,
                      session_id: Optional[str] = None) -> dict:
        base = self._base(session_id)
        try:
            df, _ = OF.extract_from_video(Path(video), duration_s)
        except OF.CorruptVideo as exc:
            return self._fail(base, "insufficient_quality", exc.code, "corrupt_video", str(exc))
        except OF.OpenFaceUnavailable as exc:
            return self._fail(base, "unavailable", exc.code, "openface_unavailable", str(exc))
        except OF.OpenFaceFailed as exc:
            return self._fail(base, "unavailable", exc.code, "openface_failed", str(exc))
        return self.analyze_frames(df, session_id)


_lock = threading.Lock()
_service: Optional[GazeService] = None


def get_gaze_service() -> GazeService:
    global _service
    with _lock:
        if _service is None:
            _service = GazeService()
        return _service


def reset_gaze_service() -> None:
    global _service
    with _lock:
        _service = None
