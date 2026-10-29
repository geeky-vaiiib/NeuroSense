#!/usr/bin/env python3
"""
data/train_speech_cnn.py — Training script for NeuroSense Speech 1D-CNN.

Dataset status:
  No publicly available ASD-labelled speech dataset exists in this
  repository.  This script provides TWO pathways:

  1. REAL DATA PATH (preferred):
     Place a labelled ASD speech dataset at:
       backend/data/speech_dataset/
         metadata.csv   (columns: participant_id, file_name, label)
         audio/          (contains .wav files referenced in metadata.csv)
     The script loads real audio, extracts 13 MFCCs matching
     speech_engine.py's _predict_cnn(), trains with participant-level
     splits, and saves with is_trained_model=True.

  2. PROXY / SYNTHETIC PATH (when no dataset exists):
     Generates synthetic MFCC-like features with planted statistical
     differences between "ASD-like" and "typical" classes.  The
     resulting checkpoint is EXPLICITLY labelled:
       - metadata.json: dataset = "SYNTHETIC_PROXY — NOT clinically validated"
       - speech_engine.py: is_trained_model = True (architecture test)
         BUT the interpretation string discloses synthetic training.
     This is honest about its limitations and intended ONLY for
     verifying that the hot-swap pipeline works end-to-end.

Architecture:
  SpeechCNN (1D-CNN):
    Conv1d(13→32, k=3, p=1) → ReLU → MaxPool1d(2)
    Conv1d(32→64, k=3, p=1) → ReLU → AdaptiveAvgPool1d(1)
    Linear(64→1)
  Input: (batch, 13, T)  — 13 MFCCs, variable length T
  Output: scalar logit → sigmoid → P(ASD)

Usage:
  cd backend/
  python -m data.train_speech_cnn                  # auto-detects data or uses synthetic
  python -m data.train_speech_cnn --mode real       # fails if no real data
  python -m data.train_speech_cnn --mode synthetic  # forces synthetic proxy

Outputs:
  backend/models/speech_cnn.pt
  backend/models/speech_cnn_metadata.json
"""

import argparse
import json
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name == "data" else SCRIPT_DIR
MODEL_DIR = BACKEND_DIR / "models"
DATA_DIR = BACKEND_DIR / "data" / "speech_dataset"


# ── Architecture (imported from train_speech.py for consistency) ─────────────

import torch
import torch.nn as nn


class SpeechCNN(nn.Module):
    """Simple 1D CNN for MFCCs expecting (batch, 13, T)."""

    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv1d(13, 32, kernel_size=3, padding=1)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(2)

        self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.AdaptiveAvgPool1d(1)

        self.fc = nn.Linear(64, 1)

    def forward(self, x):
        x = self.conv1(x)
        x = self.relu1(x)
        x = self.pool1(x)

        x = self.conv2(x)
        x = self.relu2(x)
        x = self.pool2(x)

        x = x.squeeze(2)
        x = self.fc(x)
        return x.squeeze(1)


# ── Synthetic data generation ────────────────────────────────────────────────

def generate_synthetic_data(
    n_participants: int = 60,
    samples_per_participant: int = 3,
    T: int = 216,       # ~5 seconds at sr=22050 with hop_length=512
    seed: int = 42,
):
    """Generate synthetic MFCC-like tensors with planted class differences.

    Returns (train_data, val_data) where each is list of (tensor, label).
    Splits are done STRICTLY by participant to prevent data leakage.

    The "ASD-like" class has:
      - Lower mean pitch (MFCC[1] shifted down)
      - Reduced variability across coefficients
      - Slightly different energy contour (MFCC[0])
    These patterns are inspired by Bone et al. 2014 findings about
    monotone prosody, but are NOT real clinical data.
    """
    import torch

    rng = np.random.RandomState(seed)

    # Assign participants: half ASD, half typical
    n_asd = n_participants // 2
    asd_pids_list = list(range(n_asd))
    td_pids_list = list(range(n_asd, n_participants))
    asd_pids = set(asd_pids_list)

    # Stratified split by participant: 80% train, 20% val (per class)
    rng.shuffle(asd_pids_list)
    rng.shuffle(td_pids_list)
    asd_split = int(len(asd_pids_list) * 0.8)
    td_split = int(len(td_pids_list) * 0.8)

    train_pids = asd_pids_list[:asd_split] + td_pids_list[:td_split]
    val_pids = asd_pids_list[asd_split:] + td_pids_list[td_split:]

    def make_samples(pid_list):
        data = []
        for pid in pid_list:
            is_asd = pid in asd_pids
            for _ in range(samples_per_participant):
                # Base MFCC-like features: 13 coefficients × T frames
                mfcc = rng.randn(13, T).astype(np.float32) * 5.0

                if is_asd:
                    # Plant signal: reduced variability (monotone prosody)
                    mfcc *= 0.6
                    # Shift MFCC[1] (pitch proxy) down
                    mfcc[1, :] -= 3.0
                    # Flatten energy contour
                    mfcc[0, :] = mfcc[0, :] * 0.4 + rng.randn(T).astype(np.float32) * 0.5
                else:
                    # Typical: more variability
                    mfcc[1, :] += 1.5
                    # Natural energy variation
                    mfcc[0, :] += rng.randn(T).astype(np.float32) * 2.0

                tensor = torch.tensor(mfcc, dtype=torch.float32)
                label = 1.0 if is_asd else 0.0
                data.append((tensor, torch.tensor(label, dtype=torch.float32)))
        return data

    train_data = make_samples(train_pids)
    val_data = make_samples(val_pids)

    n_train_asd = sum(1 for _, l in train_data if l.item() == 1.0)
    n_val_asd = sum(1 for _, l in val_data if l.item() == 1.0)

    print(f"  Synthetic dataset generated:")
    print(f"    Participants: {n_participants} ({len(asd_pids)} ASD, {n_participants - len(asd_pids)} TD)")
    print(f"    Train: {len(train_data)} samples ({n_train_asd} ASD, {len(train_data) - n_train_asd} TD)")
    print(f"    Val:   {len(val_data)} samples ({n_val_asd} ASD, {len(val_data) - n_val_asd} TD)")
    print(f"    Split by participant ID (no leakage)")

    return train_data, val_data, n_participants, len(asd_pids)


# ── Real data loading ────────────────────────────────────────────────────────

def load_real_data():
    """Load a labelled ASD speech dataset from backend/data/speech_dataset/.

    Expected structure:
      metadata.csv: participant_id, file_name, label (1=ASD, 0=TD)
      audio/: .wav files referenced in metadata.csv

    Returns (train_data, val_data, n_participants, n_asd).
    """
    import torch
    import librosa
    import pandas as pd

    meta_path = DATA_DIR / "metadata.csv"
    audio_dir = DATA_DIR / "audio"

    if not meta_path.exists():
        raise FileNotFoundError(f"No metadata.csv at {meta_path}")
    if not audio_dir.exists():
        raise FileNotFoundError(f"No audio/ directory at {audio_dir}")

    df = pd.read_csv(meta_path)
    required_cols = {"participant_id", "file_name", "label"}
    if not required_cols.issubset(set(df.columns)):
        raise ValueError(f"metadata.csv must have columns: {required_cols}")

    # Split by participant (strict — no leakage)
    pids = df["participant_id"].unique().tolist()
    random.shuffle(pids)
    split_idx = int(len(pids) * 0.8)
    train_pids = set(pids[:split_idx])
    val_pids = set(pids[split_idx:])

    n_asd = df[df["label"] == 1]["participant_id"].nunique()

    def load_split(pid_set):
        data = []
        subset = df[df["participant_id"].isin(pid_set)]
        for _, row in subset.iterrows():
            fpath = audio_dir / row["file_name"]
            if not fpath.exists():
                continue
            try:
                y, sr = librosa.load(str(fpath), sr=22050, mono=True, duration=25.0)
                mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
                tensor = torch.tensor(mfccs, dtype=torch.float32)
                label = torch.tensor(float(row["label"]), dtype=torch.float32)
                data.append((tensor, label))
            except Exception as e:
                print(f"  WARNING: Skipped {fpath}: {e}")
        return data

    print(f"  Loading real dataset from {DATA_DIR}")
    train_data = load_split(train_pids)
    val_data = load_split(val_pids)

    print(f"    Participants: {len(pids)} ({n_asd} ASD, {len(pids) - n_asd} TD)")
    print(f"    Train: {len(train_data)} samples")
    print(f"    Val:   {len(val_data)} samples")

    return train_data, val_data, len(pids), n_asd


# ── Training loop ────────────────────────────────────────────────────────────

def train(mode: str = "auto", epochs: int = 30, lr: float = 1e-3, batch_size: int = 16):
    """Train the SpeechCNN and save checkpoint + metadata."""
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from sklearn.metrics import (
        accuracy_score,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )

    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)

    is_synthetic = False
    dataset_id = ""

    # ── Determine data source ────────────────────────────────────────────
    has_real = (DATA_DIR / "metadata.csv").exists() and (DATA_DIR / "audio").exists()

    if mode == "real":
        if not has_real:
            print("=" * 60)
            print("  BLOCKED: --mode=real specified but no dataset found.")
            print(f"  Expected: {DATA_DIR}/metadata.csv + {DATA_DIR}/audio/")
            print("=" * 60)
            sys.exit(1)

    if mode == "synthetic" or (mode == "auto" and not has_real):
        is_synthetic = True
        dataset_id = "SYNTHETIC_PROXY — NOT clinically validated"
        print("\n" + "=" * 60)
        print("  NeuroSense — Speech CNN Training (SYNTHETIC PROXY)")
        print("  ⚠  No labelled ASD speech dataset found.")
        print("  ⚠  Training on synthetic MFCC data with planted signal.")
        print("  ⚠  The resulting model is for pipeline verification ONLY.")
        print("=" * 60)
        print()
        train_data, val_data, n_participants, n_asd = generate_synthetic_data()
    else:
        dataset_id = "ASD Speech Dataset (real)"
        print("\n" + "=" * 60)
        print("  NeuroSense — Speech CNN Training (REAL DATA)")
        print("=" * 60)
        print()
        train_data, val_data, n_participants, n_asd = load_real_data()

    if len(train_data) == 0:
        print("ERROR: No training samples loaded.")
        sys.exit(1)

    # ── Collation (pad variable-length sequences) ────────────────────────
    def collate_batch(batch):
        tensors, labels = zip(*batch)
        max_len = max(t.shape[1] for t in tensors)
        padded = []
        for t in tensors:
            pad_amt = max_len - t.shape[1]
            padded.append(nn.functional.pad(t, (0, pad_amt)))
        return torch.stack(padded), torch.stack(labels)

    train_loader = torch.utils.data.DataLoader(
        train_data, batch_size=batch_size, shuffle=True, collate_fn=collate_batch
    )
    val_loader = torch.utils.data.DataLoader(
        val_data, batch_size=batch_size, shuffle=False, collate_fn=collate_batch
    )

    # ── Model ────────────────────────────────────────────────────────────
    # SpeechCNN is defined at module-level for pickle compatibility
    model = SpeechCNN()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3)
    criterion = nn.BCEWithLogitsLoss()

    print(f"\n[3/6] Training for {epochs} epochs...")

    best_val_auc = 0.0
    best_state = None
    patience_counter = 0
    patience_limit = 7

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        n_batches = 0

        for xb, yb in train_loader:
            optimizer.zero_grad()
            out = model(xb)
            loss = criterion(out, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        # Validation
        model.eval()
        all_probs, all_labels = [], []
        val_loss = 0.0
        v_batches = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                out = model(xb)
                val_loss += criterion(out, yb).item()
                v_batches += 1
                probs = torch.sigmoid(out).numpy()
                all_probs.extend(probs.tolist())
                all_labels.extend(yb.numpy().tolist())

        try:
            val_auc = roc_auc_score(all_labels, all_probs)
        except ValueError:
            val_auc = 0.5

        scheduler.step(val_loss / max(v_batches, 1))

        print(
            f"  Epoch {epoch + 1:2d}/{epochs} | "
            f"Train Loss: {total_loss / max(n_batches, 1):.4f} | "
            f"Val Loss: {val_loss / max(v_batches, 1):.4f} | "
            f"Val AUC: {val_auc:.4f}"
        )

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience_limit:
                print(f"  Early stopping at epoch {epoch + 1}")
                break

    # ── Restore best ────────────────────────────────────────────────────
    if best_state is not None:
        model.load_state_dict(best_state)

    # ── Final evaluation ────────────────────────────────────────────────
    print(f"\n[4/6] Final evaluation...")
    model.eval()
    all_probs, all_labels = [], []
    with torch.no_grad():
        for xb, yb in val_loader:
            out = model(xb)
            probs = torch.sigmoid(out).numpy()
            all_probs.extend(probs.tolist())
            all_labels.extend(yb.numpy().tolist())

    preds = [1 if p >= 0.5 else 0 for p in all_probs]
    acc = accuracy_score(all_labels, preds)
    prec = precision_score(all_labels, preds, zero_division=0)
    rec = recall_score(all_labels, preds, zero_division=0)
    f1 = f1_score(all_labels, preds, zero_division=0)
    try:
        auc = roc_auc_score(all_labels, all_probs)
    except ValueError:
        auc = 0.5

    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1:        {f1:.4f}")
    print(f"  AUC-ROC:   {auc:.4f}")

    # ── Save checkpoint ─────────────────────────────────────────────────
    print(f"\n[5/6] Saving checkpoint...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODEL_DIR / "speech_cnn.pt"
    torch.save(model, model_path)
    print(f"  Saved model → {model_path}")

    # ── Save metadata (required by _load_cnn validation) ────────────────
    meta_path = MODEL_DIR / "speech_cnn_metadata.json"
    metadata = {
        "architecture": "SpeechCNN_1D",
        "feature_order": ["MFCC_13"],
        "preprocessing_version": "librosa_22050_25s",
        "sample_rate": 22050,
        "input_dimensions": "(batch, 13, T)",
        "labels": {"0": "Typical", "1": "ASD"},
        "threshold": 0.5,
        "dataset_identifier": dataset_id,
        "is_synthetic_proxy": is_synthetic,
        "n_participants": n_participants,
        "n_asd": n_asd,
        "n_td": n_participants - n_asd,
        "train_samples": len(train_data),
        "val_samples": len(val_data),
        "model_version": "1.0",
        "training_seed": 42,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "evaluation_metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(auc, 4),
        },
    }

    if is_synthetic:
        metadata["limitation"] = (
            "This model was trained on SYNTHETIC MFCC data with planted "
            "statistical differences between classes. It is NOT trained on "
            "real ASD speech recordings. Scores are for pipeline verification "
            "only and have NO clinical validity."
        )
        metadata["planted_signal"] = (
            "ASD-class: reduced MFCC variability (×0.6), shifted MFCC[1] "
            "(pitch proxy) −3.0, flattened energy contour. Inspired by "
            "Bone et al. 2014 findings on monotone prosody."
        )

    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  Saved metadata → {meta_path}")

    print(f"\n[6/6] Training complete!")
    if is_synthetic:
        print("  ⚠  DISCLOSURE: This checkpoint is a SYNTHETIC PROXY.")
        print("     It is for pipeline verification only — not clinical use.")
        print("     speech_engine.py will hot-swap to this checkpoint and")
        print("     set is_trained_model=True, but the metadata discloses")
        print("     synthetic training honestly.")
    else:
        print("  ✓  Checkpoint trained on real labelled data.")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train NeuroSense Speech 1D-CNN."
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "real", "synthetic"],
        default="auto",
        help=(
            "'auto': use real data if available, else synthetic. "
            "'real': require real data. "
            "'synthetic': force synthetic proxy."
        ),
    )
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    train(mode=args.mode, epochs=args.epochs, lr=args.lr, batch_size=args.batch_size)
