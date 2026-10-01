"""Canonical gaze schema + pipeline constants (single source of truth).

Pipeline (identical for DASD training and NeuroSense webcam inference):

    OpenFace 2.x FeatureExtraction CSV
      -> preprocess.standardize_frame   (select + validate columns)
      -> preprocess.clean_frames        (confidence / success / jump / timestamp rules)
      -> preprocess.resample            (fixed RESAMPLE_HZ grid, short gaps interpolated)
      -> preprocess.build_features      (FEATURE_NAMES, normalisation)
      -> preprocess.make_windows        (WINDOW_STEPS x len(FEATURE_NAMES))
      -> model.GazeBiLSTM               (window probability)
      -> inference.aggregate            (participant/session probability)

Only features OpenFace really emits are used.  Pupil diameter, screen coordinates and
other eye-tracker quantities do not exist in this pipeline and are never synthesised.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

MODEL_VERSION = "gaze-openface-dasd-v1"
DATASET_NAME = "DASD"
FEATURE_SCHEMA_VERSION = "openface-gaze-1.0.0"
OPENFACE_VERSION = "OpenFace 2.x FeatureExtraction (DASD distributes OpenFace 2.0 CSVs)"
OPENFACE_FLAGS = ("-gaze", "-pose")   # flags passed in deployment (see openface.py)

# Raw OpenFace columns the pipeline needs (names after whitespace stripping).
REQUIRED_COLUMNS: tuple[str, ...] = (
    "timestamp", "confidence", "success", "gaze_angle_x", "gaze_angle_y",
)
HEAD_POSE_COLUMNS: tuple[str, ...] = ("pose_Rx", "pose_Ry", "pose_Rz")

# Frame validity rules
MIN_CONFIDENCE = 0.80            # OpenFace face-tracking confidence
MAX_ABS_GAZE_ANGLE = 1.2         # rad; larger values are tracker failures
MAX_GAZE_SPEED = 25.0            # rad/s; faster frame-to-frame jumps are impossible
MAX_GAP_S = 0.25                 # gaps up to this are linearly interpolated, longer ones are holes
MAX_SESSION_S = 180.0


@dataclass(frozen=True)
class PreprocessConfig:
    """Everything that changes the tensor fed to the model (snapshotted in the checkpoint)."""
    feature_names: tuple[str, ...] = (
        "gaze_angle_x", "gaze_angle_y", "gaze_vel_x", "gaze_vel_y",
        "head_pose_x", "head_pose_y", "head_pose_z",
    )
    resample_hz: int = 10
    window_s: float = 6.0
    stride_s: float = 1.0
    min_window_coverage: float = 0.8     # share of real (non-hole) steps required in a window
    center_window: bool = False          # subtract the window mean from position features
    normalization: str = "global_zscore"  # statistics are learned on training participants only

    @property
    def window_steps(self) -> int:
        return int(round(self.window_s * self.resample_hz))

    @property
    def stride_steps(self) -> int:
        return max(1, int(round(self.stride_s * self.resample_hz)))

    def to_dict(self) -> dict:
        d = asdict(self)
        d["feature_names"] = list(self.feature_names)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "PreprocessConfig":
        d = dict(d)
        d["feature_names"] = tuple(d["feature_names"])
        return cls(**d)


# Deployed configuration.  Chosen on the training-participant CV only (see the training
# report); the training script rewrites the checkpoint metadata with the selected config
# and the service refuses a checkpoint whose config differs from this one.
DEPLOYED = PreprocessConfig()
FEATURE_NAMES = DEPLOYED.feature_names
FEATURE_ORDER = {n: i for i, n in enumerate(FEATURE_NAMES)}
SEQUENCE_LENGTH = DEPLOYED.window_steps
SAMPLING_RATE = DEPLOYED.resample_hz
NORMALIZATION_METHOD = DEPLOYED.normalization

# Session quality gate (applied before any model call)
MIN_DURATION_S = 8.0
MIN_VALID_FRAME_RATIO = 0.50
MIN_WINDOWS = 3
MIN_TRACKING_CONTINUITY = 0.50
FACE_CENTER_TOLERANCE = 0.35      # fraction of frame width/height allowed off-centre (positioning check)

# Error codes
ERR_NO_FACE = "GAZE_NO_FACE"
ERR_LOW_CONFIDENCE = "GAZE_LOW_CONFIDENCE"
ERR_TOO_FEW_FRAMES = "GAZE_TOO_FEW_FRAMES"
ERR_CORRUPT_VIDEO = "GAZE_CORRUPT_VIDEO"
ERR_OPENFACE_MISSING = "GAZE_OPENFACE_UNAVAILABLE"
ERR_OPENFACE_FAILED = "GAZE_OPENFACE_FAILED"
ERR_MODEL_MISSING = "GAZE_MODEL_MISSING"
ERR_MODEL_MISMATCH = "GAZE_MODEL_SCHEMA_MISMATCH"
ERR_QUALITY = "GAZE_SESSION_QUALITY_INSUFFICIENT"
ERR_INFERENCE = "GAZE_INFERENCE_FAILED"
