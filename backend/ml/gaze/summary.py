"""Session-level summary features built from the SAME windows the sequence model uses.

windows (W, L, F; session-centred position channels) -> per-window robust statistics -> median over
windows -> one vector per session.  Using fixed-length windows keeps the statistics independent of
recording duration (a range over a 60 s clip would otherwise be larger than over a 10 s clip, and
DASD's ASD recordings are longer).  Pure numpy; shared by training and inference.
"""

from __future__ import annotations

import numpy as np

STAT_NAMES = ("std", "range", "iqr", "mean_abs_vel", "p95_abs_vel")


def window_stats(windows: np.ndarray, hz: int) -> np.ndarray:
    """(W, L, F) -> (W, F * len(STAT_NAMES)); velocity is the finite difference of the channel in units/s."""
    cols = []
    for j in range(windows.shape[2]):
        x = windows[:, :, j]
        v = np.abs(np.diff(x, axis=1)) * hz
        q75, q25 = np.percentile(x, [75, 25], axis=1)
        cols += [x.std(1), x.max(1) - x.min(1), q75 - q25, v.mean(1), np.percentile(v, 95, axis=1)]
    return np.stack(cols, axis=1)


def feature_names(channel_names) -> list[str]:
    return [f"{c}:{s}" for c in channel_names for s in STAT_NAMES]


def session_summary(windows: np.ndarray, hz: int) -> np.ndarray:
    """Median over windows of the window statistics -> (F * len(STAT_NAMES),)."""
    if len(windows) == 0:
        raise ValueError("no windows to summarise")
    return np.median(window_stats(windows, hz), axis=0)
