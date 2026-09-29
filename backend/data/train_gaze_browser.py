"""
train_gaze_browser.py — train the browser-compatible gaze BiLSTM.

Why this exists
---------------
The original checkpoint (gaze_lstm.pt, train_gaze.py) takes 5 inputs including
pupil diameter, which WebGazer/FaceMesh cannot measure, and a device-labelled
fixation flag, dt across concatenated sessions and raw hardware pixels.  This
script trains on the same Cilia et al. (2022) data but ONLY through the shared
inference preprocessing (backend/ml/gaze/preprocess.py), so training and
serving cannot drift:

    dataset rows -> canonical samples -> validate_samples -> I-DT fixations ->
    10 Hz resample -> [x, y, speed, is_fixation] -> normalise -> pad to 300

Protocol
--------
* one participant = one unit; every 30 s window of a participant stays in one fold
* 5-fold stratified participant-level CV, fixed epoch count (chosen a priori, no
  selection on the held-out fold) -> honest out-of-fold participant AUC
* the shipped model is then fitted on all participants with the same epochs

Output: backend/models/gaze_lstm_browser.pt (state_dict + metadata).
Run:    python3 backend/data/train_gaze_browser.py
"""

from __future__ import annotations

import hashlib
import io
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold

from backend.data import train_gaze as tg
from backend.ml.gaze import config as C
from backend.ml.gaze.model import GazeLSTM
from backend.ml.gaze.preprocess import (
    build_feature_matrix, normalize, pad_sequence, validate_samples,
)

OUT = ROOT / "backend" / "models" / "gaze_lstm_browser.pt"
WINDOW_MS = C.SEQ_LEN * C.STEP_MS
MAX_WINDOWS_PER_PARTICIPANT = 10
EPOCHS = 15
FOLDS = 5
SEED = 42
HPARAMS = dict(hidden_size=64, num_layers=2, lstm_dropout=0.3, fc_dropout=0.4)


# ── data ─────────────────────────────────────────────────────────────────────

def participant_windows() -> tuple[dict[str, list[np.ndarray]], dict[str, int]]:
    """Per participant: a list of un-normalised (T, 4) feature windows, plus labels."""
    meta = tg.load_metadata()
    frames: dict[str, list[pd.DataFrame]] = {}
    for path in sorted(tg.DATA_DIR.glob("*.csv"), key=lambda p: int(p.stem)):
        df = tg.load_participant_records(path)
        if df.empty:
            continue
        for pid, sub in df.groupby(df["Participant"].astype(str)):
            if pid in meta.index:
                frames.setdefault(pid, []).append(sub)

    missing = sorted(set(meta.index) - set(frames), key=lambda p: int(p))
    if missing:
        print(f"WARNING: {len(missing)} metadata participants have no usable gaze CSV data: "
              f"{', '.join(missing)} (excluded)")

    windows: dict[str, list[np.ndarray]] = {}
    labels: dict[str, int] = {}
    for pid, dfs in frames.items():
        d = pd.concat(dfs).sort_values("RecordingTime [ms]")
        samples = [
            {"timestamp": t, "x": x, "y": y, "face_detected": True}
            for t, x, y in zip(
                d["RecordingTime [ms]"].values,
                d["Point of Regard Right X [px]"].values,
                d["Point of Regard Right Y [px]"].values,
            )
        ]
        cleaned = validate_samples(samples, C.DATASET_SCREEN_W, C.DATASET_SCREEN_H)
        wins = _cut_windows(cleaned)
        if not wins:
            continue
        if len(wins) > MAX_WINDOWS_PER_PARTICIPANT:
            keep = np.linspace(0, len(wins) - 1, MAX_WINDOWS_PER_PARTICIPANT).round().astype(int)
            wins = [wins[i] for i in keep]
        windows[pid] = wins
        labels[pid] = int(meta.loc[pid, "label"])
    return windows, labels


def _cut_windows(cleaned) -> list[np.ndarray]:
    """Cut contiguous WINDOW_MS chunks of valid samples; keep those >= MIN_SEQ_STEPS."""
    from backend.ml.gaze.preprocess import CleanedSamples, segment_bounds
    out: list[np.ndarray] = []
    for lo, hi in segment_bounds(cleaned.t_ms):
        t0 = cleaned.t_ms[lo]
        start = lo
        while start < hi:
            end = start
            while end < hi and cleaned.t_ms[end] - cleaned.t_ms[start] < WINDOW_MS:
                end += 1
            chunk = CleanedSamples(
                t_ms=cleaned.t_ms[start:end], x=cleaned.x[start:end], y=cleaned.y[start:end],
                stimulus=[None] * (end - start), n_total=end - start,
            )
            feats = build_feature_matrix(chunk)
            if len(feats) >= C.MIN_SEQ_STEPS:
                out.append(feats)
            start = end
    return out


# ── training ─────────────────────────────────────────────────────────────────

def fit_norm(train_wins: list[np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    allf = np.concatenate(train_wins, axis=0)          # real (unpadded) steps only
    return allf.mean(0).astype(np.float32), (allf.std(0) + 1e-6).astype(np.float32)


def to_tensors(wins, mean, std):
    import torch
    xs, ls = [], []
    for w in wins:
        p, n = pad_sequence(normalize(w, mean, std))
        xs.append(p); ls.append(n)
    return torch.from_numpy(np.stack(xs)), torch.tensor(ls, dtype=torch.long)


def train_model(wins: list[np.ndarray], y: np.ndarray, mean, std):
    import torch
    import torch.nn as nn
    torch.manual_seed(SEED)
    X, L = to_tensors(wins, mean, std)
    yt = torch.tensor(y, dtype=torch.float32)
    model = GazeLSTM(input_size=len(C.FEATURE_NAMES), **HPARAMS)
    pos = float(y.sum()); neg = float(len(y) - pos)
    crit = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([neg / max(pos, 1.0)]))
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    g = torch.Generator().manual_seed(SEED)
    for _ in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(yt), generator=g)
        for i in range(0, len(perm), 16):
            b = perm[i:i + 16]
            if len(b) < 2:            # BatchNorm needs >1 sample
                continue
            opt.zero_grad()
            crit(model(X[b], L[b]), yt[b]).backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
    model.eval()
    return model


def predict(model, wins, mean, std) -> np.ndarray:
    import torch
    X, L = to_tensors(wins, mean, std)
    with torch.no_grad():
        return torch.sigmoid(model(X, L)).numpy()


def main():
    print("=" * 60)
    print("  NeuroSense browser-compatible gaze model")
    print(f"  features={list(C.FEATURE_NAMES)}  seq_len={C.SEQ_LEN} @ {C.RESAMPLE_HZ} Hz")
    print("=" * 60)
    windows, labels = participant_windows()
    pids = sorted(windows, key=int)
    y_p = np.array([labels[p] for p in pids])
    n_win = sum(len(windows[p]) for p in pids)
    print(f"Participants: {len(pids)} (ASD={int(y_p.sum())}, TD={int((y_p == 0).sum())}) | windows: {n_win}")

    # ── participant-level stratified CV ──
    oof = np.zeros(len(pids))
    fold_aucs = []
    skf = StratifiedKFold(FOLDS, shuffle=True, random_state=SEED)
    for k, (tr, te) in enumerate(skf.split(pids, y_p), 1):
        assert not ({pids[i] for i in tr} & {pids[i] for i in te}), "participant leakage"
        tr_w = [w for i in tr for w in windows[pids[i]]]
        tr_y = np.array([y_p[i] for i in tr for _ in windows[pids[i]]])
        mean, std = fit_norm(tr_w)
        model = train_model(tr_w, tr_y, mean, std)
        for i in te:
            oof[i] = predict(model, windows[pids[i]], mean, std).mean()   # participant = mean of windows
        auc = roc_auc_score(y_p[te], oof[te])
        fold_aucs.append(auc)
        print(f"  Fold {k}/{FOLDS} | train participants {len(tr)} | test {len(te)} | AUC {auc:.3f}")
    cv_auc = roc_auc_score(y_p, oof)
    print(f"[CV] out-of-fold participant AUC: {cv_auc:.3f} "
          f"(fold mean {np.mean(fold_aucs):.3f} ± {np.std(fold_aucs):.3f}; epochs fixed at {EPOCHS}, not tuned)")

    # ── final fit on all participants ──
    all_w = [w for p in pids for w in windows[p]]
    all_y = np.array([labels[p] for p in pids for _ in windows[p]])
    mean, std = fit_norm(all_w)
    model = train_model(all_w, all_y, mean, std)
    state = model.state_dict()
    buf = io.BytesIO()
    import torch
    torch.save(state, buf)
    version = f"gaze-bilstm-browser-v1-{hashlib.sha256(buf.getvalue()).hexdigest()[:8]}"

    torch.save({
        "model_state_dict": state,
        "input_size": len(C.FEATURE_NAMES),
        **HPARAMS,
        "feature_names": list(C.FEATURE_NAMES),
        "mean": mean.tolist(),
        "std": std.tolist(),
        "preprocess_config": C.preprocess_config(),
        "model_version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset": "Cilia et al. (2022) eye-tracking dataset (children 2-13 y, SMI hardware)",
        "n_participants": len(pids),
        "n_asd": int(y_p.sum()),
        "n_windows": n_win,
        "epochs": EPOCHS,
        "cv_protocol": f"{FOLDS}-fold stratified participant-level, out-of-fold participant AUC",
        "cv_auc": float(cv_auc),
        "cv_fold_aucs": [float(a) for a in fold_aucs],
        "domain_validated": False,   # never evaluated on webcam/WebGazer data
    }, OUT)
    print(f"[SAVE] {OUT}  version={version}")


if __name__ == "__main__":
    main()
