"""Run OpenFace's FeatureExtraction on a recording and parse its CSV.

The same executable/flags must be used for DASD-style training features and for NeuroSense
webcam recordings.  Locate OpenFace with, in order:
  1. env OPENFACE_BIN        path to the native `FeatureExtraction` binary
  2. `FeatureExtraction` on PATH
  3. env OPENFACE_DOCKER_IMAGE  (e.g. algebr/openface, OpenFace 2.x, amd64 -> runs emulated on Apple silicon)
Nothing here ever fabricates output: if OpenFace cannot run, OpenFaceUnavailable is raised.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd

from . import config as C


DOCKER_BIN = "/home/openface-build/build/bin/FeatureExtraction"   # path inside algebr/openface


class OpenFaceUnavailable(RuntimeError):
    code = C.ERR_OPENFACE_MISSING


class OpenFaceFailed(RuntimeError):
    code = C.ERR_OPENFACE_FAILED


class CorruptVideo(ValueError):
    code = C.ERR_CORRUPT_VIDEO


@dataclass
class VideoInfo:
    frames: int
    fps: float
    width: int
    height: int


def inspect_video(path: Path) -> VideoInfo:
    """Open the file with OpenCV; raise CorruptVideo when it holds no decodable frames."""
    import cv2
    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise CorruptVideo("video could not be opened")
        n = 0; w = h = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if n == 0:
                h, w = frame.shape[:2]
            n += 1
        if n == 0:
            raise CorruptVideo("video contains no decodable frames")
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        return VideoInfo(n, float(fps), w, h)
    finally:
        cap.release()


def normalize_video(src: Path, dst: Path, duration_s: Optional[float]) -> VideoInfo:
    """Re-encode to MJPEG/AVI at the true frame rate.  Browser MediaRecorder WebM files carry no
    reliable fps/duration, and OpenFace derives its timestamps from the container fps, so the
    client-measured recording duration is used to set it (frames / duration)."""
    import cv2
    info = inspect_video(src)
    fps = info.frames / duration_s if duration_s and duration_s > 0 else info.fps
    if not (1.0 <= fps <= 120.0):
        raise CorruptVideo(f"cannot determine a plausible frame rate (got {fps:.2f})")
    cap = cv2.VideoCapture(str(src))
    out = cv2.VideoWriter(str(dst), cv2.VideoWriter_fourcc(*"MJPG"), fps, (info.width, info.height))
    if not out.isOpened():
        cap.release()
        raise OpenFaceFailed("could not create the normalised video")
    n = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        out.write(fr); n += 1
    cap.release(); out.release()
    return VideoInfo(n, fps, info.width, info.height)


def find_openface() -> Optional[list[str]]:
    """-> argv prefix for FeatureExtraction, or None."""
    env = os.environ.get("OPENFACE_BIN")
    if env and Path(env).exists():
        return [env]
    found = shutil.which("FeatureExtraction")
    if found:
        return [found]
    return None


def is_available() -> bool:
    return find_openface() is not None or bool(os.environ.get("OPENFACE_DOCKER_IMAGE") and shutil.which("docker"))


def run_openface(video: Path, out_dir: Path, timeout_s: int = 600) -> Path:
    """Run FeatureExtraction; returns the produced CSV path."""
    prefix = find_openface()
    flags = list(C.OPENFACE_FLAGS)
    if prefix:
        cmd = prefix + ["-f", str(video), "-out_dir", str(out_dir), *flags]
    elif os.environ.get("OPENFACE_DOCKER_IMAGE") and shutil.which("docker"):
        d_in = video.parent
        cmd = ["docker", "run", "--rm", "--platform", "linux/amd64", "-v", f"{d_in}:/in:ro", "-v", f"{out_dir}:/out",
               "--entrypoint", DOCKER_BIN, os.environ["OPENFACE_DOCKER_IMAGE"],
               "-f", f"/in/{video.name}", "-out_dir", "/out", *flags]
    else:
        raise OpenFaceUnavailable("OpenFace FeatureExtraction not found (set OPENFACE_BIN or OPENFACE_DOCKER_IMAGE)")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired as exc:
        raise OpenFaceFailed(f"OpenFace timed out after {timeout_s}s") from exc
    csv = out_dir / (video.stem + ".csv")
    if proc.returncode != 0 or not csv.exists():
        raise OpenFaceFailed(f"OpenFace exited {proc.returncode}: {(proc.stderr or proc.stdout)[-300:]}")
    return csv


def parse_output(csv_path: Path) -> pd.DataFrame:
    """Read an OpenFace CSV (column names have leading spaces, handled by preprocess)."""
    if not Path(csv_path).exists():
        raise OpenFaceFailed("OpenFace produced no output file")
    df = pd.read_csv(csv_path)
    if df.empty:
        raise OpenFaceFailed("OpenFace output contains no rows")
    return df


def extract_from_video(video: Path, duration_s: Optional[float] = None) -> tuple[pd.DataFrame, VideoInfo]:
    """video -> (OpenFace dataframe, normalised video info).  Temporary files are always removed."""
    with tempfile.TemporaryDirectory(prefix="ns_gaze_") as tmp:
        tmp = Path(tmp)
        norm = tmp / "recording.avi"
        info = normalize_video(video, norm, duration_s)
        out = tmp / "of"; out.mkdir()
        return parse_output(run_openface(norm, out)), info
