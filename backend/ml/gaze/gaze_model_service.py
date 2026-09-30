"""Gaze model service: load + validate checkpoint, preprocess, infer, report quality.

The FastAPI route and the screening pipeline both call ``GazeModelService.analyze``;
no model or preprocessing logic lives in a route.  It never fabricates a
probability: if the checkpoint, session or category cannot legitimately be
scored, ``probability`` is ``None`` and a machine-readable reason is returned.
"""

from __future__ import annotations

import json
import sys
import logging
import math
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

from . import config as C
from .preprocess import (
    build_feature_matrix, normalize, pad_sequence, summarize, validate_samples,
)
from .quality import QualityReport, assess

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
BROWSER_CKPT = MODELS_DIR / "gaze_lstm_browser.pt"
LEGACY_CKPT = MODELS_DIR / "gaze_lstm.pt"                   # 5-feature, needs pupil
LEGACY_META = MODELS_DIR / "gaze_lstm_metadata.json"

REQUIRED_CKPT_KEYS = (
    "model_state_dict", "feature_names", "input_size", "hidden_size", "num_layers",
    "mean", "std", "preprocess_config", "model_version",
)


class CheckpointError(Exception):
    """Raised (with a machine-readable ``reason``) when a checkpoint is unusable."""

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason


def validate_checkpoint(ckpt: dict) -> None:
    """Raise CheckpointError unless ``ckpt`` matches the current browser pipeline."""
    missing = [k for k in REQUIRED_CKPT_KEYS if k not in ckpt]
    if missing:
        raise CheckpointError("checkpoint_incomplete", ",".join(missing))
    names = list(ckpt["feature_names"])
    unavailable = [n for n in names if n not in C.BROWSER_AVAILABLE_FEATURES]
    if unavailable:
        raise CheckpointError("requires_unavailable_feature", ",".join(unavailable))
    if names != list(C.FEATURE_NAMES):
        raise CheckpointError("feature_order_mismatch", f"{names} != {list(C.FEATURE_NAMES)}")
    if int(ckpt["input_size"]) != len(names):
        raise CheckpointError("input_size_mismatch", str(ckpt["input_size"]))
    if len(ckpt["mean"]) != len(names) or len(ckpt["std"]) != len(names):
        raise CheckpointError("normalization_mismatch")
    if ckpt["preprocess_config"] != C.preprocess_config():
        raise CheckpointError("preprocess_config_mismatch")


def _legacy_incompatibility() -> Optional[str]:
    """Explain why the older 5-feature checkpoint cannot be used from the browser."""
    if not LEGACY_CKPT.exists():
        return None
    try:
        feats = json.loads(LEGACY_META.read_text()).get("input_features") or \
            json.loads(LEGACY_META.read_text()).get("feature_names") or []
    except Exception:
        return None
    missing = [f for f in feats if f in ("pupil_diam", "pupil")]
    return f"gaze_lstm.pt requires {','.join(missing)} which the browser cannot measure" if missing else None


def legacy_checkpoint_report() -> dict:
    """Why backend/models/gaze_lstm.pt (5 features incl. pupil) is not used for browser sessions."""
    if not LEGACY_CKPT.exists():
        return {"present": False}
    try:
        meta = json.loads(LEGACY_META.read_text())
    except Exception:
        return {"present": True, "compatible": False, "blocking": ["metadata_unreadable"]}
    feats = list(meta.get("input_features") or [])
    blocking = []
    if "pupil_diam" in feats:
        blocking.append("pupil_diam: measured only by the eye-tracking hardware; WebGazer/FaceMesh expose no pupil diameter")
    if "is_fixation" in feats:
        blocking.append("is_fixation: hardware event label (SMI); browser data only allows a derived I-DT approximation")
    if "dt_ms" in feats:
        blocking.append("dt_ms: trained on ~50-60 Hz hardware timing over 2000-step sequences; browser sessions are ~30 Hz and shorter")
    return {
        "present": True,
        "compatible": False,
        "features": feats,
        "sequence_length": meta.get("max_seq_len"),
        "blocking": blocking,
    }


class GazeModelService:
    def __init__(self, ckpt_path: Path = BROWSER_CKPT):
        self.ckpt_path = Path(ckpt_path)
        self.model = None
        self.meta: dict = {}
        self.unavailable_reason: Optional[str] = None
        self.unavailable_detail: Optional[str] = None
        self._load()

    # ── loading ──────────────────────────────────────────────────────────────
    def _load(self) -> None:
        self._last_load_attempt = time.monotonic()
        try:
            import torch  # noqa: F401
            from .model import load_gaze_lstm
        except ImportError as exc:
            # Keep the real cause: a missing torch and a broken import look identical otherwise.
            self._set_unavailable(
                "torch_not_installed",
                f"{type(exc).__name__}: {exc} (interpreter: {sys.executable}) -- install backend/requirements.txt into this environment",
            )
            return
        if not self.ckpt_path.exists():
            self._set_unavailable("no_compatible_checkpoint", _legacy_incompatibility())
            return
        try:
            model, ckpt = load_gaze_lstm(self.ckpt_path)
            validate_checkpoint(ckpt)
        except CheckpointError as exc:
            self._set_unavailable(exc.reason, str(exc))
            return
        except Exception as exc:
            self._set_unavailable("checkpoint_load_failed", f"{type(exc).__name__}: {exc}")
            return
        self.model = model
        self.meta = {k: v for k, v in ckpt.items() if k != "model_state_dict"}
        self._mean = np.asarray(ckpt["mean"], dtype=np.float32)
        self._std = np.asarray(ckpt["std"], dtype=np.float32)
        logger.info("[NeuroSense] Gaze model %s loaded from %s", self.model_version, self.ckpt_path)

    def _set_unavailable(self, reason: str, detail: Optional[str] = None) -> None:
        self.model = None
        self.unavailable_reason = reason
        self.unavailable_detail = detail
        logger.warning("[NeuroSense] Gaze model unavailable: %s %s", reason, detail or "")

    _TRANSIENT_REASONS = ("torch_not_installed", "checkpoint_load_failed", "no_compatible_checkpoint")
    RELOAD_INTERVAL_S = 30.0

    def _retry_load_if_transient(self) -> None:
        """A failed load (import hiccup, file still being written) must not stick until restart.
        Deliberate refusals (incompatible/version mismatch) are never retried."""
        if (not self.available and self.unavailable_reason in self._TRANSIENT_REASONS
                and time.monotonic() - getattr(self, "_last_load_attempt", 0.0) > self.RELOAD_INTERVAL_S):
            self.unavailable_reason = self.unavailable_detail = None
            self._load()

    # ── introspection ────────────────────────────────────────────────────────
    @property
    def available(self) -> bool:
        return self.model is not None

    @property
    def model_version(self) -> Optional[str]:
        return self.meta.get("model_version")

    _INCOMPATIBLE_REASONS = (
        "requires_unavailable_feature", "feature_order_mismatch", "input_size_mismatch",
        "normalization_mismatch", "preprocess_config_mismatch", "checkpoint_incomplete",
    )

    @property
    def model_status(self) -> str:
        """trained | incompatible (a checkpoint exists but cannot accept browser input) | unavailable"""
        if self.available:
            return "trained"
        return "incompatible" if self.unavailable_reason in self._INCOMPATIBLE_REASONS else "unavailable"

    def _error_code(self) -> str:
        r = self.unavailable_reason
        if r == "preprocess_config_mismatch":
            return C.ERR_PREPROCESS_MISMATCH
        if r in self._INCOMPATIBLE_REASONS:
            return C.ERR_INPUT_INCOMPATIBLE
        if r == "no_compatible_checkpoint":
            return C.ERR_MODEL_MISSING
        return C.ERR_MODEL_LOAD_FAILED

    def health(self) -> dict:
        """Safe for the public health endpoint: no paths, no internals."""
        return {
            "available": self.available,
            "loaded": self.available,
            "model_status": self.model_status,
            "model_version": self.model_version,
            "preprocessing_version": C.GAZE_PREPROCESSING_VERSION,
            "expected_features": len(C.FEATURE_NAMES),
            "sequence_length": C.SEQ_LEN,
            "error_code": None if self.available else self._error_code(),
        }

    def get_model_info(self) -> dict:
        """Authenticated detail: contract, provenance and evaluation of the loaded checkpoint."""
        info = {**self.health(), "feature_names": list(C.FEATURE_NAMES),
                "resample_hz": C.RESAMPLE_HZ, "legacy_checkpoint": legacy_checkpoint_report()}
        if self.available:
            info.update({k: self.meta.get(k) for k in (
                "trained_at", "dataset", "n_participants", "n_windows", "epochs",
                "cv_protocol", "cv_auc", "domain_validated")})
        return info

    def status(self) -> dict:
        return {
            "available": self.available,
            "model_version": self.model_version,
            "reason": self.unavailable_reason,
            "detail": self.unavailable_detail,
            "feature_names": list(C.FEATURE_NAMES),
            "seq_len": C.SEQ_LEN,
        }

    # ── tensor construction (exposed so tests can inspect the exact model input) ─
    def build_tensor(self, feats: np.ndarray):
        """Normalise, pad and batch: returns (tensor[1, SEQ_LEN, F], lengths[1])."""
        import torch
        padded, real = pad_sequence(normalize(feats, self._mean, self._std))
        return (
            torch.from_numpy(padded).unsqueeze(0),
            torch.tensor([real], dtype=torch.long),
        )

    def predict_features(self, feats: np.ndarray) -> float:
        import torch
        x, lengths = self.build_tensor(feats)
        assert x.shape == (1, C.SEQ_LEN, len(C.FEATURE_NAMES)), x.shape
        with torch.no_grad():
            prob = float(torch.sigmoid(self.model(x, lengths))[0].item())
        if not math.isfinite(prob) or not 0.0 <= prob <= 1.0:
            raise ValueError(f"model produced invalid probability {prob!r}")
        return prob

    # ── public entry point ───────────────────────────────────────────────────
    def analyze(self, session: dict) -> dict:
        """Score one canonical gaze session (see schemas/gaze.py). Never raises for bad data."""
        self._retry_load_if_transient()
        category = session.get("category", "child")
        cleaned = validate_samples(
            session.get("samples") or [],
            float(session["screen_width"]),
            float(session["screen_height"]),
        )
        feats = build_feature_matrix(cleaned)
        summary = summarize(cleaned)
        quality = assess(cleaned, session.get("calibration"), len(feats), summary.get("fixation_ratio"))

        if category not in C.SUPPORTED_CATEGORIES:
            return self._result(session, "unavailable", None, quality, summary,
                                reason="category_not_supported", error_code=C.ERR_CATEGORY)
        if not self.available:
            return self._result(session, "unavailable", None, quality, summary,
                                reason=self.unavailable_reason, detail=self.unavailable_detail,
                                error_code=self._error_code())
        if not quality.valid:
            return self._result(session, "insufficient_quality", None, quality, summary,
                                reason=quality.reason, error_code=C.ERR_QUALITY)
        try:
            prob = self.predict_features(feats)
        except Exception as exc:
            logger.exception("Gaze inference failed")
            return self._result(session, "unavailable", None, quality, summary,
                                reason="inference_failed", detail=f"{type(exc).__name__}: {exc}",
                                error_code=C.ERR_INFERENCE_FAILED)
        return self._result(session, "success", round(prob, 4), quality, summary)

    def _result(self, session: dict, status: str, prob: Optional[float],
                quality: QualityReport, summary: dict,
                reason: Optional[str] = None, detail: Optional[str] = None,
                error_code: Optional[str] = None) -> dict:
        ok = status == "success"
        cv_auc = self.meta.get("cv_auc") if self.available else None
        fusion_eligible = bool(ok and cv_auc is not None and cv_auc >= C.MIN_FUSION_CV_AUC)
        return {
            "modality": "gaze",
            "status": status,
            "probability": prob,
            "model_status": self.model_status,
            "model_version": self.model_version,
            "preprocessing_version": C.GAZE_PREPROCESSING_VERSION,
            "error_code": error_code,
            "reason": reason,
            "detail": detail,
            "session_id": session.get("session_id"),
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
            "quality": quality.to_dict(),
            "features": summary,
            "fusion_eligible": fusion_eligible,
            "validation": None if not self.available else {
                "cv_auc": cv_auc, "cv_protocol": self.meta.get("cv_protocol"),
                "domain_validated": self.meta.get("domain_validated", False),
                "min_cv_auc_for_fusion": C.MIN_FUSION_CV_AUC,
            },
            "interpretation": (
                "Gaze model output (screening signal) from a research model trained on "
                "hardware eye-tracking data; it is not a diagnosis and has not been "
                "validated on webcam-based gaze."
                + ("" if fusion_eligible else " Its cross-validated performance is below the threshold "
                   "required to influence the final screening probability, so it is shown for research "
                   "context only.")
                if ok else ""
            ),
            # ── fusion_engine.fuse() compatibility ──
            "score": prob,
            "isMock": False,
            # fusion_engine treats is_trained_model=False scores as supplemental only
            "is_trained_model": fusion_eligible,
            "method": "lstm_trained",
            "modality_label": "Gaze Analysis (BiLSTM — Cilia et al. 2022 dataset, browser features)",
        }


_service: Optional[GazeModelService] = None
_lock = threading.Lock()


def get_gaze_service() -> GazeModelService:
    global _service
    if _service is None:
        with _lock:
            if _service is None:
                _service = GazeModelService()
    return _service


def reset_gaze_service() -> None:
    """Drop the cached service (tests / after retraining)."""
    global _service
    _service = None
