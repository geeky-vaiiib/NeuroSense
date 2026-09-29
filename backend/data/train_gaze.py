"""
train_gaze.py — Train a GazeLSTM for ASD screening using the Cilia et al. (2022)
Eye-Tracking Dataset.

Dataset structure
-----------------
  Eye-Tracking Dataset/
    Metadata_Participants.csv   — ParticipantID, Gender, Age, Class (ASD/TD), CARS Score
    Eye-tracking Output/
      1.csv … 25.csv            — per-session raw ET records (one file may span >1 participant)

Features extracted per participant (aggregated across all their sessions)
------------------------------------------------------------------------
  Sequence model (LSTM):  [por_x, por_y, dt_ms, is_fixation, pupil_diam]
  Statistical baseline:   14 hand-crafted features fed to a Random Forest

Outputs
-------
  backend/models/gaze_lstm.pt
  backend/models/gaze_lstm_metadata.json
  backend/models/gaze_rf.joblib          (Random-Forest fallback, no torch needed)

Usage
-----
  python -m backend.data.train_gaze               # from project root
  python backend/data/train_gaze.py               # direct
"""

from __future__ import annotations

import copy
import json
import os
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

if str(Path(__file__).resolve().parent.parent.parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.preprocessing import StandardScaler

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent.parent   # project root
DATA_DIR = ROOT / "Eye-Tracking Dataset" / "Eye-tracking Output"
META_CSV = ROOT / "Eye-Tracking Dataset" / "Metadata_Participants.csv"
MODELS_DIR = ROOT / "backend" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

LSTM_OUT = MODELS_DIR / "gaze_lstm.pt"
META_OUT = MODELS_DIR / "gaze_lstm_metadata.json"
RF_OUT   = MODELS_DIR / "gaze_rf.joblib"

# ── Constants ────────────────────────────────────────────────────────────────
MAX_SEQ_LEN = 2000          # pad/truncate LSTM input to this many timesteps
FIXATION_RADIUS_PX = 80    # cluster threshold for fixation annotation (1024x768 space)
SCREEN_W, SCREEN_H = 1024, 768

FACE_AOI_KEYWORDS = {
    "yeux", "bouche", "visage", "face", "eye", "mouth",
    "regard", "joie", "triste", "neutre",
}

warnings.filterwarnings("ignore")


# ===============================================================================
# 1.  DATA LOADING
# ===============================================================================

def load_metadata() -> pd.DataFrame:
    meta = pd.read_csv(META_CSV)
    meta["ParticipantID"] = meta["ParticipantID"].astype(str)
    meta["label"] = (meta["Class"] == "ASD").astype(int)
    return meta.set_index("ParticipantID")


def is_face_aoi(aoi_name: str) -> bool:
    if aoi_name in ("-", "", "White Space", "nan"):
        return False
    lname = str(aoi_name).lower()
    return any(kw in lname for kw in FACE_AOI_KEYWORDS)


def load_participant_records(csv_path: Path) -> pd.DataFrame:
    """Load one eye-tracking CSV, keep only 'Eye' category rows with valid coords.
    Handles schema differences across files (some lack Pupil Diameter column).
    """
    try:
        df = pd.read_csv(csv_path, dtype=str, low_memory=False)
    except Exception as exc:
        print(f"  [SKIP] {csv_path.name}: {exc}")
        return pd.DataFrame()

    if "Category Group" not in df.columns:
        return pd.DataFrame()

    df = df[df["Category Group"] == "Eye"].copy()

    required_numeric = [
        "Point of Regard Right X [px]",
        "Point of Regard Right Y [px]",
        "RecordingTime [ms]",
    ]
    optional_numeric = ["Pupil Diameter Right [mm]"]

    # Convert required columns
    for col in required_numeric:
        if col not in df.columns:
            return pd.DataFrame()   # can't continue without coords
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Convert optional columns — fill with sentinel if missing
    for col in optional_numeric:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            df[col] = 4.0   # physiological average pupil diameter

    df = df.dropna(subset=required_numeric)
    return df.reset_index(drop=True)



# ===============================================================================
# 2.  FEATURE EXTRACTION
# ===============================================================================

def extract_statistical_features(df: pd.DataFrame) -> dict:
    """Extract 14 statistical features from a participant's full gaze record."""
    x = df["Point of Regard Right X [px]"].values.astype(float)
    y = df["Point of Regard Right Y [px]"].values.astype(float)
    t = df["RecordingTime [ms]"].values.astype(float)
    pupil = df["Pupil Diameter Right [mm]"].fillna(4.0).values.astype(float)
    cat = df.get("Category Right", pd.Series(dtype=str)).fillna("-").values

    fix_mask = np.array([c == "Fixation" for c in cat])
    sac_mask = np.array([c == "Saccade"  for c in cat])
    n = len(x)

    fix_ratio = fix_mask.sum() / n if n > 0 else 0.0
    sac_ratio = sac_mask.sum() / n if n > 0 else 0.0

    # Mean fixation duration
    fix_durations = []
    in_fix = False
    fix_start = 0.0
    for i in range(n):
        if fix_mask[i] and not in_fix:
            in_fix = True
            fix_start = t[i]
        elif not fix_mask[i] and in_fix:
            in_fix = False
            fix_durations.append(t[i] - fix_start)
    mean_fix_dur = float(np.mean(fix_durations)) if fix_durations else 0.0
    std_fix_dur  = float(np.std(fix_durations))  if fix_durations else 0.0

    # Saccade amplitude
    sac_amps = []
    for i in range(1, n):
        if sac_mask[i]:
            amp = np.sqrt((x[i] - x[i-1])**2 + (y[i] - y[i-1])**2)
            sac_amps.append(amp)
    mean_sac_amp = float(np.mean(sac_amps)) if sac_amps else 0.0

    # Gaze spread
    gaze_std_x  = float(np.std(x))
    gaze_std_y  = float(np.std(y))
    gaze_mean_x = float(np.mean(x))
    gaze_mean_y = float(np.mean(y))

    # Social/face AOI ratio
    aoi_col = "AOI Name Right" if "AOI Name Right" in df.columns else None
    if aoi_col:
        face_mask  = df[aoi_col].apply(is_face_aoi).values
        face_ratio = float(face_mask.sum() / n) if n > 0 else 0.0
    else:
        face_ratio = 0.0

    # Pupil stats
    mean_pupil = float(np.nanmean(pupil))
    std_pupil  = float(np.nanstd(pupil))

    # Scanpath length
    dxs = np.diff(x)
    dys = np.diff(y)
    scanpath_len = float(np.sum(np.sqrt(dxs**2 + dys**2)))

    return {
        "fix_ratio":      fix_ratio,
        "sac_ratio":      sac_ratio,
        "mean_fix_dur":   mean_fix_dur,
        "std_fix_dur":    std_fix_dur,
        "mean_sac_amp":   mean_sac_amp,
        "gaze_std_x":     gaze_std_x,
        "gaze_std_y":     gaze_std_y,
        "gaze_mean_x":    gaze_mean_x,
        "gaze_mean_y":    gaze_mean_y,
        "face_aoi_ratio": face_ratio,
        "mean_pupil":     mean_pupil,
        "std_pupil":      std_pupil,
        "scanpath_len":   scanpath_len,
        "n_records":      float(n),
    }


def build_sequence(df: pd.DataFrame, max_len: int):
    """Build a (max_len, 5) float32 array: [por_x, por_y, dt_ms, is_fix, pupil]."""
    x     = df["Point of Regard Right X [px]"].values.astype(np.float32)
    y     = df["Point of Regard Right Y [px]"].values.astype(np.float32)
    t     = df["RecordingTime [ms]"].values.astype(np.float32)
    pupil = df["Pupil Diameter Right [mm]"].fillna(4.0).values.astype(np.float32)
    cat   = df.get("Category Right", pd.Series(dtype=str)).fillna("-").values
    is_fix = np.array([1.0 if c == "Fixation" else 0.0 for c in cat], dtype=np.float32)

    dt = np.concatenate([[0.0], np.diff(t)])
    seq = np.stack([x, y, dt, is_fix, pupil], axis=1)   # (N, 5)

    real_len = min(len(seq), max_len)
    padded = np.zeros((max_len, 5), dtype=np.float32)
    padded[:real_len] = seq[:real_len]
    return padded, real_len


# ===============================================================================
# 3.  BUILD DATASET
# ===============================================================================

def build_dataset(meta: pd.DataFrame):
    stat_rows: list[dict]        = []
    seq_list:  list[np.ndarray]  = []
    seq_lens:  list[int]         = []
    labels:    list[int]         = []
    pids:      list[str]         = []

    csv_files = sorted(DATA_DIR.glob("*.csv"), key=lambda p: int(p.stem))
    print(f"Found {len(csv_files)} CSV files in dataset.")

    participant_dfs: dict[str, list[pd.DataFrame]] = {}

    for csv_path in csv_files:
        print(f"  Loading {csv_path.name} ...", end="\r")
        df = load_participant_records(csv_path)
        if df.empty:
            continue
        for pid in df["Participant"].astype(str).unique():
            if pid not in ("Unidentified(Neg)", "Unidentified(Pos)"):
                sub = df[df["Participant"].astype(str) == pid]
                participant_dfs.setdefault(pid, []).append(sub)

    print(f"\nParticipants found in data: {sorted(participant_dfs.keys())}")

    for pid, dfs in participant_dfs.items():
        if pid not in meta.index:
            print(f"  [SKIP] Participant {pid} not in metadata.")
            continue

        label    = meta.loc[pid, "label"]
        combined = pd.concat(dfs, ignore_index=True).sort_values("RecordingTime [ms]")

        feats = extract_statistical_features(combined)
        feats["pid"]   = pid
        feats["label"] = label
        stat_rows.append(feats)

        seq, real_len = build_sequence(combined, MAX_SEQ_LEN)
        seq_list.append(seq)
        seq_lens.append(real_len)
        labels.append(int(label))
        pids.append(pid)

    missing = sorted(set(meta.index) - set(pids), key=lambda p: int(p) if p.isdigit() else p)
    if missing:
        print(f"\nWARNING: {len(missing)} metadata participants have no usable gaze CSV data:\n"
              f"{', '.join(missing)}  (excluded from RF, LSTM, validation)")
    print(f"\nTotal participants processed: {len(labels)}")
    print(f"  ASD: {sum(labels)}   TD: {labels.count(0)}")

    stat_df = pd.DataFrame(stat_rows).set_index("pid")
    X_seq   = np.array(seq_list, dtype=np.float32)
    y       = np.array(labels,   dtype=np.int64)

    return stat_df, X_seq, np.array(seq_lens, dtype=np.int64), y, pids


# ===============================================================================
# 4.  RANDOM FOREST BASELINE
# ===============================================================================

def train_random_forest(stat_df: pd.DataFrame, y: np.ndarray):
    import joblib

    feat_cols = [c for c in stat_df.columns if c != "label"]
    X = stat_df[feat_cols].values.astype(np.float32)

    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)

    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=1,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    if len(y) >= 5:
        cv = StratifiedKFold(n_splits=min(5, len(y)), shuffle=True, random_state=42)
        y_prob_cv = cross_val_predict(rf, X_s, y, cv=cv, method="predict_proba")[:, 1]
        auc = roc_auc_score(y, y_prob_cv)
        print(f"\n[RF] 5-fold Cross-Val AUC (RF only, not comparable to LSTM val AUC): {auc:.3f}")
        y_pred_cv = (y_prob_cv >= 0.5).astype(int)
        print(classification_report(y, y_pred_cv, target_names=["TD", "ASD"]))
    else:
        print("[RF] Too few samples for cross-val.")

    rf.fit(X_s, y)
    joblib.dump({"model": rf, "scaler": scaler, "feature_names": feat_cols}, RF_OUT)
    print(f"[RF] Saved -> {RF_OUT}")
    return rf, scaler, feat_cols


# ===============================================================================
# 5.  LSTM MODEL
# ===============================================================================

LSTM_HPARAMS = dict(input_size=5, hidden_size=64, num_layers=2, lstm_dropout=0.3, fc_dropout=0.4)
MAX_EPOCHS = 60
PATIENCE = 10            # early stopping on validation AUC
SPLIT_SEED = 42


def participant_split(y: np.ndarray, pids: list[str], frac: float = 0.8):
    """Stratified 80/20 split at PARTICIPANT level.

    X_seq holds exactly one sequence per participant (all of a participant's
    sessions are concatenated in build_dataset), so splitting rows == splitting
    participants; a participant can never be in both train and val.
    """
    rng = np.random.RandomState(SPLIT_SEED)
    tr, va = [], []
    for cls in (1, 0):
        idx = np.where(y == cls)[0]
        rng.shuffle(idx)
        n_train = max(1, int(len(idx) * frac))
        tr.extend(idx[:n_train]); va.extend(idx[n_train:])
    tr, va = np.array(tr), np.array(va)
    assert len(set(pids)) == len(pids), "duplicate participant IDs"
    assert not ({pids[i] for i in tr} & {pids[i] for i in va}), "participant leakage"
    return tr, va


def train_lstm(X_seq: np.ndarray, seq_lens: np.ndarray, y: np.ndarray, pids: list[str]):
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, TensorDataset
        from backend.ml.gaze_lstm import GazeLSTM
    except ImportError:
        print("[LSTM] PyTorch not available -- skipping LSTM.")
        return

    if len(y) < 4:
        print("[LSTM] Too few samples for LSTM training -- need at least 4.")
        return

    print("\n[LSTM] Starting training ...")

    flat = X_seq.reshape(-1, 5)
    mean = flat.mean(axis=0)
    std  = flat.std(axis=0) + 1e-8

    X_norm = (X_seq - mean) / std

    X_t = torch.tensor(X_norm, dtype=torch.float32)
    l_t = torch.tensor(seq_lens, dtype=torch.long)
    y_t = torch.tensor(y, dtype=torch.float32)

    tr_idx, va_idx = participant_split(y, pids)
    print(f"  Split: stratified participant-level, seed={SPLIT_SEED}, no participant in both sets")
    print(f"  Train ASD/TD: {int(y[tr_idx].sum())}/{int((y[tr_idx]==0).sum())} | "
          f"Val ASD/TD: {int(y[va_idx].sum())}/{int((y[va_idx]==0).sum())}")

    print(f"  Train: {len(tr_idx)} | Val: {len(va_idx)}")

    train_loader = DataLoader(TensorDataset(X_t[tr_idx], l_t[tr_idx], y_t[tr_idx]), batch_size=8, shuffle=True)
    val_loader   = DataLoader(TensorDataset(X_t[va_idx], l_t[va_idx], y_t[va_idx]), batch_size=8, shuffle=False)

    torch.manual_seed(SPLIT_SEED)
    model = GazeLSTM(**LSTM_HPARAMS)

    n_pos = y.sum()
    n_neg = len(y) - n_pos
    pos_weight = torch.tensor([n_neg / (n_pos + 1e-8)], dtype=torch.float32)

    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=5
    )

    best_auc, best_epoch, best_state = -1.0, 0, None
    stale = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        total_loss = 0.0
        for Xb, lb, yb in train_loader:
            optimizer.zero_grad()
            logits = model(Xb, lb)
            loss = criterion(logits, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        all_probs, all_y = [], []
        with torch.no_grad():
            for Xb, lb, yb in val_loader:
                probs = torch.sigmoid(model(Xb, lb)).cpu().numpy()
                all_probs.extend(probs)
                all_y.extend(yb.cpu().numpy())

        auc = roc_auc_score(all_y, all_probs) if len(set(all_y)) >= 2 else 0.0
        scheduler.step(auc)
        train_loss = total_loss / len(train_loader)

        improved = auc > best_auc
        if improved:
            best_auc, best_epoch = auc, epoch
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1

        print(f"  Epoch {epoch:02d}/{MAX_EPOCHS} | Train Loss: {train_loss:.4f} | Val AUC: {auc:.3f}")
        if improved:
            print(f"  ★ New best model | Epoch {epoch:02d} | Val AUC: {auc:.3f}")
        if stale >= PATIENCE:
            print(f"  Early stopping at epoch {epoch} (no val AUC improvement for {PATIENCE} epochs)")
            break

    model.load_state_dict(best_state)   # restore best, not last, epoch
    print(f"\n[LSTM] Best Epoch: {best_epoch}")
    print(f"[LSTM] Best Val AUC: {best_auc:.3f}  (single 12-participant validation split)")

    torch.save({
        "model_state_dict": best_state,
        **LSTM_HPARAMS,
        "best_epoch": best_epoch,
        "best_val_auc": float(best_auc),
        "max_seq_len": MAX_SEQ_LEN,
    }, LSTM_OUT)

    metadata = {
        "normalization": {
            "mean": mean.tolist(),
            "std":  std.tolist(),
        },
        "max_seq_len": MAX_SEQ_LEN,
        "input_features": ["por_x", "por_y", "dt_ms", "is_fixation", "pupil_diam"],
        "screen_w": SCREEN_W,
        "screen_h": SCREEN_H,
        "best_val_auc": round(float(best_auc), 4),
        "best_epoch": best_epoch,
        "input_size": LSTM_HPARAMS["input_size"],
        "hidden_size": LSTM_HPARAMS["hidden_size"],
        "num_layers": LSTM_HPARAMS["num_layers"],
        "split": f"stratified participant-level 80/20, seed={SPLIT_SEED}",
        "architecture": "BiLSTM(hidden=64, layers=2) + BatchNorm + Dropout(0.4) + FC",
        "dataset": "Cilia et al. (2022) Eye-Tracking Dataset -- IJCAI/ECAI SDAIH",
        "n_train": int(len(tr_idx)),
        "n_val":   int(len(va_idx)),
        "is_trained_model": True,
    }

    with open(META_OUT, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"[LSTM] Saved -> {LSTM_OUT}")
    print(f"[LSTM] Metadata -> {META_OUT}")


# ===============================================================================
# 6.  VERIFY SAVED ARTIFACTS
# ===============================================================================

def verify_outputs(stat_df: pd.DataFrame):
    print("\n[VERIFY]")
    try:
        import joblib
        import torch
        from backend.ml.gaze_lstm import load_gaze_lstm
    except ImportError:
        print("  torch unavailable -- skipped")
        return
    model, ckpt = load_gaze_lstm(LSTM_OUT)
    print(f"  ✓ LSTM checkpoint loaded (best epoch {ckpt['best_epoch']}, val AUC {ckpt['best_val_auc']:.3f})")
    x = torch.randn(1, MAX_SEQ_LEN, 5)
    with torch.no_grad():
        p = torch.sigmoid(model(x, torch.tensor([300]))).item()
    assert 0.0 <= p <= 1.0
    print(f"  ✓ Test inference successful (p={p:.3f})")
    b = joblib.load(RF_OUT)
    b["model"].predict_proba(b["scaler"].transform(stat_df[b["feature_names"]].values[:1]))
    print("  ✓ RF model still loads successfully")


# ===============================================================================
# 7.  MAIN
# ===============================================================================

def main():
    print("=" * 60)
    print("  NeuroSense Gaze Model Training")
    print("  Dataset: Cilia et al. (2022) Eye-Tracking Dataset")
    print("=" * 60)

    print("\n[1/4] Loading metadata ...")
    meta = load_metadata()
    print(f"  Participants: {len(meta)}  (ASD={meta['label'].sum()}, TD={(meta['label']==0).sum()})")

    print("\n[2/4] Building dataset (this may take a few minutes) ...")
    stat_df, X_seq, seq_lens, y, pids = build_dataset(meta)

    if len(y) == 0:
        print("[ERROR] No valid participants extracted. Aborting.")
        sys.exit(1)

    print("\n[3/4] Training Random Forest baseline ...")
    train_random_forest(stat_df.drop(columns=["label"]), y)

    print("\n[4/4] Training LSTM ...")
    train_lstm(X_seq, seq_lens, y, pids)
    verify_outputs(stat_df)

    print("\n" + "=" * 60)
    print("  Training complete!")
    print(f"  Models saved to: {MODELS_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
