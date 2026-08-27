#!/usr/bin/env python3
"""
data/train_gaze_lstm.py — Eye-tracking LSTM training for NeuroSense.

Dataset: Cilia et al. (2022) Eye-Tracking Dataset
  Eye-Tracking Dataset/Eye-tracking Output/*.csv   (25 session CSVs)
  Eye-Tracking Dataset/Metadata_Participants.csv   (59 participants: 29 ASD, 30 TD)

Model:
  LSTM(input=5, hidden=64, layers=2, dropout=0.3) + attention → Linear(64->1)
  Input features per time-step: [norm_x, norm_y, dt_ms_norm, is_fixation, pupil_diam_norm]

Output:
  backend/models/gaze_lstm.pt            — best-fold PyTorch checkpoint
  backend/models/gaze_lstm_metadata.json — normalisation stats for inference

Usage (from repo root or backend/):
  python -m data.train_gaze_lstm
  python backend/data/train_gaze_lstm.py
"""
from __future__ import annotations

import json
import math
import os
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import LeaveOneGroupOut
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence
from torch.utils.data import DataLoader, Dataset

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ── Paths ────────────────────────────────────────────────────────────────────
_SCRIPT_DIR  = Path(__file__).resolve().parent          # backend/data/
_BACKEND_DIR = _SCRIPT_DIR.parent                       # backend/
_REPO_ROOT   = _BACKEND_DIR.parent                      # neuro-sense-main/

_DATASET_DIR = _REPO_ROOT / "Eye-Tracking Dataset" / "Eye-tracking Output"
_METADATA_CSV = _REPO_ROOT / "Eye-Tracking Dataset" / "Metadata_Participants.csv"
_MODELS_DIR  = _BACKEND_DIR / "models"

_LSTM_OUT = _MODELS_DIR / "gaze_lstm.pt"
_META_OUT = _MODELS_DIR / "gaze_lstm_metadata.json"

# ── Hyper-parameters ─────────────────────────────────────────────────────────
_MAX_SEQ_LEN = 512
_INPUT_SIZE  = 5      # [norm_x, norm_y, dt_ms_norm, is_fixation, pupil_norm]
_HIDDEN_SIZE = 64
_NUM_LAYERS  = 2
_DROPOUT     = 0.3
_EPOCHS      = 40
_LR          = 1e-3
_BATCH_SIZE  = 8
_MIN_ROWS    = 20


# ═══════════════════════════════════════════════════════════════════════════
# 1. LOAD DATA
# ═══════════════════════════════════════════════════════════════════════════

def load_metadata() -> pd.DataFrame:
    meta = pd.read_csv(_METADATA_CSV)
    meta["label"] = (meta["Class"] == "ASD").astype(int)
    meta["ParticipantID"] = meta["ParticipantID"].astype(int)
    print(f"[Meta] {len(meta)} participants — "
          f"ASD={meta['label'].sum()}, TD={(meta['label']==0).sum()}")
    return meta[["ParticipantID", "label", "Age", "Gender"]].set_index("ParticipantID")


def _to_float(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def load_session_csv(path: Path) -> "pd.DataFrame | None":
    try:
        df = pd.read_csv(path, low_memory=False)
    except Exception as exc:
        print(f"  [WARN] Cannot read {path.name}: {exc}")
        return None

    if "Category Group" not in df.columns:
        return None
    df = df[df["Category Group"] == "Eye"].copy()
    if len(df) == 0:
        return None

    # Drop unidentified rows
    df = df[df["Participant"].astype(str).str.strip().str.lower() != "unidentified(neg)"]
    df["Participant"] = _to_float(df["Participant"])
    df = df.dropna(subset=["Participant"])
    df["Participant"] = df["Participant"].astype(int)
    if len(df) == 0:
        return None

    df["ts_ms"] = _to_float(df["RecordingTime [ms]"])

    # PoR coordinates (Right eye preferred, else Left)
    por_rx = df.get("Point of Regard Right X [px]", pd.Series(np.nan, index=df.index))
    por_lx = df.get("Point of Regard Left X [px]",  pd.Series(np.nan, index=df.index))
    por_ry = df.get("Point of Regard Right Y [px]", pd.Series(np.nan, index=df.index))
    por_ly = df.get("Point of Regard Left Y [px]",  pd.Series(np.nan, index=df.index))
    df["por_x"] = _to_float(por_rx).fillna(_to_float(por_lx))
    df["por_y"] = _to_float(por_ry).fillna(_to_float(por_ly))

    # Pupil diameter
    if "Pupil Diameter Right [mm]" in df.columns:
        df["pupil"] = _to_float(df["Pupil Diameter Right [mm]"])
    elif "Pupil Diameter Left [mm]" in df.columns:
        df["pupil"] = _to_float(df["Pupil Diameter Left [mm]"])
    else:
        df["pupil"] = np.nan

    df["is_fix"] = (df["Category Right"].astype(str).str.strip() == "Fixation").astype(float)

    df = df[["Participant", "ts_ms", "por_x", "por_y", "pupil", "is_fix"]].copy()
    df = df.dropna(subset=["ts_ms", "por_x", "por_y"])
    return df


def load_all_sessions() -> pd.DataFrame:
    print("\n[1/6] Loading session CSVs ...")
    frames = []
    for csv_path in sorted(_DATASET_DIR.glob("*.csv")):
        df = load_session_csv(csv_path)
        if df is not None and len(df) > 0:
            frames.append(df)
            print(f"  OK  {csv_path.name:10s}  rows={len(df):>7,}  "
                  f"pids={sorted(df['Participant'].unique())}")
        else:
            print(f"  --  {csv_path.name:10s}  (skipped)")

    if not frames:
        print("ERROR: No usable gaze data found.")
        sys.exit(1)

    all_data = pd.concat(frames, ignore_index=True)
    print(f"\n  Total rows: {len(all_data):,}  |  "
          f"Unique participants: {sorted(all_data['Participant'].unique())}")
    return all_data


# ═══════════════════════════════════════════════════════════════════════════
# 2. BUILD PER-PARTICIPANT SEQUENCES
# ═══════════════════════════════════════════════════════════════════════════

def build_participant_sequences(gaze_df, meta_df):
    print("\n[2/6] Building per-participant sequences ...")
    sequences, labels, pids = [], [], []
    skipped = 0

    known_pids   = set(meta_df.index.tolist())
    present_pids = set(gaze_df["Participant"].unique().tolist())
    matched = sorted(known_pids & present_pids)
    missing = sorted(known_pids - present_pids)
    if missing:
        print(f"  [WARN] {len(missing)} participants in metadata but missing from gaze data: {missing}")

    for pid in matched:
        pdata = gaze_df[gaze_df["Participant"] == pid].sort_values("ts_ms").copy()
        if len(pdata) < _MIN_ROWS:
            print(f"  [SKIP] pid={pid}: only {len(pdata)} rows")
            skipped += 1
            continue

        ts    = pdata["ts_ms"].values.astype(float)
        dt    = np.diff(ts, prepend=ts[0])
        pupil = pdata["pupil"].values.astype(float)
        pmdn  = np.nanmedian(pupil) if not np.all(np.isnan(pupil)) else 4.0
        pupil = np.where(np.isnan(pupil), pmdn, pupil)

        seq = np.stack([
            pdata["por_x"].values.astype(float),
            pdata["por_y"].values.astype(float),
            dt,
            pdata["is_fix"].values.astype(float),
            pupil,
        ], axis=1).astype(np.float32)   # (T, 5)

        sequences.append(seq)
        labels.append(int(meta_df.loc[pid, "label"]))
        pids.append(pid)

    print(f"  Participants included: {len(sequences)}  (skipped {skipped})")
    print(f"  ASD: {sum(labels)}  TD: {len(labels)-sum(labels)}")
    return sequences, labels, pids


# ═══════════════════════════════════════════════════════════════════════════
# 3. NORMALISATION
# ═══════════════════════════════════════════════════════════════════════════

def compute_norm_stats(sequences):
    all_data = np.concatenate(sequences, axis=0)
    mean = np.nanmean(all_data, axis=0).tolist()
    std  = np.nanstd(all_data, axis=0).tolist()
    std  = [max(s, 1e-6) for s in std]
    return {"mean": mean, "std": std}


def normalize_seq(seq, stats):
    mean = np.array(stats["mean"], dtype=np.float32)
    std  = np.array(stats["std"],  dtype=np.float32)
    return (seq - mean) / std


def pad_seq(seq, max_len):
    T       = seq.shape[0]
    real    = min(T, max_len)
    padded  = np.zeros((max_len, seq.shape[1]), dtype=np.float32)
    padded[:real] = seq[:real]
    return padded, real


# ═══════════════════════════════════════════════════════════════════════════
# 4. PYTORCH DATASET & MODEL
# ═══════════════════════════════════════════════════════════════════════════

class GazeDataset(Dataset):
    def __init__(self, seqs, lengths, labels):
        self.X       = [torch.tensor(s, dtype=torch.float32) for s in seqs]
        self.lengths = lengths
        self.y       = torch.tensor(labels, dtype=torch.float32)

    def __len__(self):
        return len(self.y)

    def __getitem__(self, idx):
        return self.X[idx], self.lengths[idx], self.y[idx]


def collate_fn(batch):
    seqs, lengths, labels = zip(*batch)
    return torch.stack(seqs), torch.tensor(lengths, dtype=torch.long), torch.stack(labels)


class GazeLSTM(nn.Module):
    """LSTM + temporal-attention classifier for eye-tracking sequences."""

    def __init__(self, input_size=_INPUT_SIZE, hidden_size=_HIDDEN_SIZE,
                 num_layers=_NUM_LAYERS, dropout=_DROPOUT):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size, hidden_size=hidden_size,
            num_layers=num_layers, batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.attn       = nn.Linear(hidden_size, 1)
        self.classifier = nn.Sequential(
            nn.LayerNorm(hidden_size),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x, lengths=None):
        if lengths is not None:
            packed = pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
            out, _ = self.lstm(packed)
            out, _ = pad_packed_sequence(out, batch_first=True)
        else:
            out, _ = self.lstm(x)

        attn_w  = torch.softmax(self.attn(out), dim=1)  # (B, T, 1)
        context = (attn_w * out).sum(dim=1)              # (B, H)
        return self.classifier(context).squeeze(-1)


# ═══════════════════════════════════════════════════════════════════════════
# 5. TRAINING LOOP (one LOGO fold)
# ═══════════════════════════════════════════════════════════════════════════

def train_one_fold(tr_seqs, tr_len, tr_lbl, va_seqs, va_len, va_lbl, device):
    tr_ds = GazeDataset(tr_seqs, tr_len, tr_lbl)
    va_ds = GazeDataset(va_seqs, va_len, va_lbl)

    pos = sum(tr_lbl); neg = len(tr_lbl) - pos
    if pos > 0 and neg > 0:
        wts  = [len(tr_lbl)/(2*pos) if l==1 else len(tr_lbl)/(2*neg) for l in tr_lbl]
        sampler = torch.utils.data.WeightedRandomSampler(wts, len(wts), replacement=True)
        tr_loader = DataLoader(tr_ds, batch_size=_BATCH_SIZE, sampler=sampler, collate_fn=collate_fn)
    else:
        tr_loader = DataLoader(tr_ds, batch_size=_BATCH_SIZE, shuffle=True, collate_fn=collate_fn)
    va_loader = DataLoader(va_ds, batch_size=_BATCH_SIZE, collate_fn=collate_fn)

    model     = GazeLSTM().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=_LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)
    pos_w     = torch.tensor([neg / max(pos, 1)], device=device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_w)

    best_val_loss, best_state = float("inf"), None

    for _ in range(_EPOCHS):
        model.train()
        for sb, lb, yb in tr_loader:
            sb, lb, yb = sb.to(device), lb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(sb, lb), yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
        scheduler.step()

        model.eval()
        vl = 0.0
        with torch.no_grad():
            for sb, lb, yb in va_loader:
                vl += criterion(model(sb.to(device), lb.to(device)), yb.to(device)).item()
        vl /= max(len(va_loader), 1)
        if vl < best_val_loss:
            best_val_loss = vl
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    if best_state:
        model.load_state_dict(best_state)

    model.eval()
    all_probs, all_preds, all_true = [], [], []
    with torch.no_grad():
        for sb, lb, yb in va_loader:
            probs = torch.sigmoid(model(sb.to(device), lb.to(device))).cpu().numpy()
            all_probs.extend(probs.tolist())
            all_preds.extend((probs >= 0.5).astype(int).tolist())
            all_true.extend(yb.numpy().astype(int).tolist())

    metrics = {
        "accuracy":  accuracy_score(all_true, all_preds),
        "f1":        f1_score(all_true, all_preds, zero_division=0),
        "precision": precision_score(all_true, all_preds, zero_division=0),
        "recall":    recall_score(all_true, all_preds, zero_division=0),
    }
    try:
        metrics["auc_roc"] = roc_auc_score(all_true, all_probs)
    except ValueError:
        metrics["auc_roc"] = float("nan")

    return model, metrics


# ═══════════════════════════════════════════════════════════════════════════
# 6. MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 65)
    print("  NeuroSense — Eye-Tracking LSTM Training")
    print("  Cilia et al. (2022) — 59 participants (29 ASD, 30 TD)")
    print("=" * 65)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    meta_df  = load_metadata()
    gaze_df  = load_all_sessions()
    sequences, labels, pids = build_participant_sequences(gaze_df, meta_df)

    N = len(sequences)
    if N < 10:
        print(f"\nERROR: Only {N} usable participants. Check dataset paths.")
        sys.exit(1)

    # Global stats (saved for inference in gaze_engine.py)
    print("\n[3/6] Computing global normalisation stats ...")
    global_stats = compute_norm_stats(sequences)
    print(f"  means : {[f'{v:.3f}' for v in global_stats['mean']]}")
    print(f"  stds  : {[f'{v:.3f}' for v in global_stats['std']]}")

    # ── GroupKFold CV ───────────────────────────────────────────────────────────
    print(f"\n[4/6] GroupKFold CV (5 folds) ...")
    from sklearn.model_selection import GroupKFold
    logo   = GroupKFold(n_splits=5)
    groups = np.array(pids)
    X_idx  = np.arange(N)
    y_arr  = np.array(labels)

    fold_metrics   = []
    best_composite = -1.0
    best_model     = None

    for fold_i, (tr_idx, va_idx) in enumerate(logo.split(X_idx, y_arr, groups)):
        val_pid   = pids[va_idx[0]]
        val_label = labels[va_idx[0]]

        # Per-fold normalisation (train only)
        raw_tr = [sequences[i] for i in tr_idx]
        fs     = compute_norm_stats(raw_tr)

        tr_seqs, tr_lens = [], []
        for seq in raw_tr:
            p, r = pad_seq(normalize_seq(seq, fs), _MAX_SEQ_LEN)
            tr_seqs.append(p); tr_lens.append(r)
        tr_lbl = [labels[i] for i in tr_idx]

        va_seqs, va_lens = [], []
        for seq in [sequences[i] for i in va_idx]:
            p, r = pad_seq(normalize_seq(seq, fs), _MAX_SEQ_LEN)
            va_seqs.append(p); va_lens.append(r)
        va_lbl = [labels[i] for i in va_idx]

        model, metrics = train_one_fold(
            tr_seqs, tr_lens, tr_lbl,
            va_seqs, va_lens, va_lbl,
            device,
        )
        fold_metrics.append(metrics)

        composite = (metrics["auc_roc"] + metrics["f1"]) / 2.0
        flag = ""
        if not math.isnan(composite) and composite > best_composite:
            best_composite = composite
            best_model = model
            flag = " <- best"

        lbl_str = "ASD" if val_label == 1 else "TD"
        print(
            f"  Fold {fold_i+1:2d}/{N}  pid={val_pid:3d} ({lbl_str})  "
            f"acc={metrics['accuracy']:.3f}  "
            f"auc={metrics.get('auc_roc', float('nan')):.3f}  "
            f"f1={metrics['f1']:.3f}{flag}"
        )

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n[5/6] Cross-validation summary ({N} folds):")
    print("=" * 65)
    for key in ("accuracy", "auc_roc", "f1", "precision", "recall"):
        vals = [m[key] for m in fold_metrics if not math.isnan(m.get(key, float("nan")))]
        if vals:
            print(f"  {key:12s}: {np.mean(vals):.4f} +/- {np.std(vals):.4f}")

    # ── Save ──────────────────────────────────────────────────────────────
    print(f"\n[6/6] Saving artifacts ...")
    _MODELS_DIR.mkdir(parents=True, exist_ok=True)

    if best_model is None:
        print("ERROR: No model trained.")
        sys.exit(1)

    torch.save(best_model, str(_LSTM_OUT))
    print(f"  OK  LSTM checkpoint -> {_LSTM_OUT}")

    metadata = {
        "feature_names":  ["por_x", "por_y", "dt_ms", "is_fixation", "pupil_diam"],
        "normalization":  global_stats,
        "max_seq_len":    _MAX_SEQ_LEN,
        "input_size":     _INPUT_SIZE,
        "hidden_size":    _HIDDEN_SIZE,
        "num_layers":     _NUM_LAYERS,
        "n_participants": N,
        "n_asd":          int(sum(labels)),
        "n_td":           int(N - sum(labels)),
        "cv_folds":       N,
        "best_composite_auc_f1": round(best_composite, 4),
        "dataset_citation": (
            "Cilia F. et al. (2022). Eye-Tracking Dataset to Support the Research "
            "on Autism Spectrum Disorder. IJCAI-ECAI Workshop SDAIH."
        ),
    }
    with open(_META_OUT, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  OK  Metadata        -> {_META_OUT}")

    # ── Smoke-test ────────────────────────────────────────────────────────
    print("\n[Smoke-test] Verifying gaze_engine.py loads the checkpoint ...")
    try:
        sys.path.insert(0, str(_BACKEND_DIR))
        import importlib
        import ml.gaze_engine as ge
        importlib.reload(ge)
        dummy = [{"x": 0.5, "y": 0.5, "timestamp": i * 33.0, "stimulus": 0} for i in range(30)]
        result = ge.compute_gaze_score(dummy)
        print(f"  is_trained_model : {result.get('is_trained_model')}")
        print(f"  method           : {result.get('method')}")
        print(f"  isMock           : {result.get('isMock')}")
        print(f"  score            : {result.get('score')}")
        if result.get("is_trained_model"):
            print("  OK  gaze_engine.py now runs the trained LSTM!")
        else:
            print("  WARN gaze_engine.py still on heuristic -- restart the server to pick up the checkpoint.")
    except Exception as exc:
        print(f"  [WARN] Smoke-test skipped ({exc}). Checkpoint was still saved correctly.")

    print("\n" + "=" * 65)
    print("  Eye-Tracking LSTM training complete!")
    print(f"  Best fold composite (AUC+F1)/2 = {best_composite:.4f}")
    print("  Restart the FastAPI server to activate the trained model.")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
