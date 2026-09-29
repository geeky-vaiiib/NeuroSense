"""Backward-compatible re-export; the implementation lives in ml/gaze/model.py."""
try:
    from .gaze.model import ARCH_KEYS, GazeLSTM, load_gaze_lstm  # noqa: F401
except ImportError:  # pragma: no cover - top-level import from backend/
    from ml.gaze.model import ARCH_KEYS, GazeLSTM, load_gaze_lstm  # noqa: F401
