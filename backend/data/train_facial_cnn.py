#!/usr/bin/env python3
"""
data/train_facial_cnn.py — Training script for NeuroSense Facial CNN.

Dataset: FER-2013 (Goodfellow et al., 2013)
  - A general-purpose facial-expression dataset with 7 emotion categories.
  - This is NOT an ASD-specific facial dataset.  It is used as a proxy to
    learn affective feature representations that *may* transfer to
    ASD-related flat-affect detection.
  - Limitation: FER-2013 was designed for emotion classification in the
    general population.  Its relevance to ASD screening has not been
    clinically validated.  Scores from this model MUST be transparently
    disclosed as "proxy / research-grade" in the inference pipeline.

Binary reframing for ASD proxy:
  FER-2013 labels: 0=Angry, 1=Disgust, 2=Fear, 3=Happy, 4=Sad, 5=Surprise, 6=Neutral
  We reframe as:
    - "Reduced affective display" (proxy for flat affect): Neutral (6)
    - "Typical affective display": all others (0-5)
  This is a research proxy only and does not constitute clinical evidence.

Usage:
  1. Download FER-2013 from Kaggle: https://www.kaggle.com/datasets/msambare/fer2013
  2. Place fer2013.csv at: backend/data/facial_dataset/fer2013.csv
     OR place the image folder structure at: backend/data/facial_dataset/train/ and
     backend/data/facial_dataset/test/
  3. Run:
     cd backend/
     python -m data.train_facial_cnn

Outputs:
  backend/models/facial_model.pt
  backend/models/facial_cnn_metadata.json
"""

import argparse
import json
import os
import sys
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name == "data" else SCRIPT_DIR
MODEL_DIR = BACKEND_DIR / "models"
DATA_DIR = BACKEND_DIR / "data" / "facial_dataset"

# Expected data locations
FER_CSV_PATH = DATA_DIR / "fer2013.csv"
FER_TRAIN_DIR = DATA_DIR / "train"
FER_TEST_DIR = DATA_DIR / "test"


def check_dataset() -> str:
    """Check which FER-2013 format is available and return 'csv', 'folder', or 'none'."""
    if FER_CSV_PATH.exists():
        return "csv"
    if FER_TRAIN_DIR.exists() and FER_TEST_DIR.exists():
        return "folder"
    return "none"


def load_fer_csv() -> tuple:
    """Load FER-2013 from CSV and return (X_train, y_train), (X_val, y_val)."""
    import pandas as pd
    import torch

    print(f"[1/7] Loading FER-2013 CSV from {FER_CSV_PATH}")
    df = pd.read_csv(FER_CSV_PATH)

    # Expected columns: emotion, pixels, Usage
    if "emotion" not in df.columns or "pixels" not in df.columns:
        print(f"ERROR: CSV missing expected columns. Found: {list(df.columns)}")
        sys.exit(1)

    # Binary reframing: Neutral (6) = 1 (reduced affect), Others = 0 (typical)
    df["target"] = (df["emotion"] == 6).astype(int)
    print(f"       Total samples: {len(df)}")
    print(f"       Neutral (proxy ASD): {df['target'].sum()}")
    print(f"       Typical: {(df['target'] == 0).sum()}")

    # Split by Usage column
    train_df = df[df["Usage"] == "Training"]
    val_df = df[df["Usage"].isin(["PublicTest", "PrivateTest"])]

    def parse_pixels(row):
        pixels = np.array(row["pixels"].split(), dtype=np.float32).reshape(48, 48)
        # Resize to 128x128 by simple upscaling
        from PIL import Image
        img = Image.fromarray(pixels.astype(np.uint8), mode="L").convert("RGB")
        img = img.resize((128, 128), Image.BILINEAR)
        arr = np.array(img, dtype=np.float32).transpose(2, 0, 1) / 255.0
        return arr

    print("[2/7] Parsing pixel data...")
    X_train = np.stack(train_df.apply(parse_pixels, axis=1).values)
    y_train = train_df["target"].values.astype(np.float32)

    X_val = np.stack(val_df.apply(parse_pixels, axis=1).values)
    y_val = val_df["target"].values.astype(np.float32)

    print(f"       Train: {len(X_train)} samples")
    print(f"       Val:   {len(X_val)} samples")

    return (X_train, y_train), (X_val, y_val)


def load_fer_folder() -> tuple:
    """Load FER-2013 from image folder structure."""
    from PIL import Image

    print(f"[1/7] Loading FER-2013 from folder structure at {DATA_DIR}")

    def load_split(split_dir: Path):
        images = []
        labels = []
        # FER-2013 folder structure: split_dir/emotion_name/*.jpg
        # Neutral folder = reduced affect proxy
        for emotion_dir in sorted(split_dir.iterdir()):
            if not emotion_dir.is_dir():
                continue
            is_neutral = emotion_dir.name.lower() in ("neutral", "6")
            label = 1.0 if is_neutral else 0.0
            for img_path in emotion_dir.glob("*.jpg"):
                try:
                    img = Image.open(img_path).convert("RGB").resize((128, 128))
                    arr = np.array(img, dtype=np.float32).transpose(2, 0, 1) / 255.0
                    images.append(arr)
                    labels.append(label)
                except Exception:
                    continue
            for img_path in emotion_dir.glob("*.png"):
                try:
                    img = Image.open(img_path).convert("RGB").resize((128, 128))
                    arr = np.array(img, dtype=np.float32).transpose(2, 0, 1) / 255.0
                    images.append(arr)
                    labels.append(label)
                except Exception:
                    continue

        return np.stack(images), np.array(labels, dtype=np.float32)

    X_train, y_train = load_split(FER_TRAIN_DIR)
    X_val, y_val = load_split(FER_TEST_DIR)

    print(f"       Train: {len(X_train)} samples")
    print(f"       Val:   {len(X_val)} samples")
    print(f"       Train neutral (proxy ASD): {int(y_train.sum())}")
    print(f"       Val neutral (proxy ASD):   {int(y_val.sum())}")

    return (X_train, y_train), (X_val, y_val)


def train(epochs: int = 10, batch_size: int = 64, lr: float = 1e-3):
    """Main training pipeline."""
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

    # ── Check dataset ────────────────────────────────────────────────────
    fmt = check_dataset()
    if fmt == "none":
        print("=" * 60)
        print("  BLOCKED: No FER-2013 dataset found.")
        print()
        print("  To train the facial CNN, download FER-2013 and place it at:")
        print(f"    CSV:    {FER_CSV_PATH}")
        print(f"    Folder: {FER_TRAIN_DIR}/ and {FER_TEST_DIR}/")
        print()
        print("  Dataset: https://www.kaggle.com/datasets/msambare/fer2013")
        print()
        print("  NeuroSense policy: We do not fabricate training data.")
        print("  Until a legitimate dataset is available, the facial")
        print("  modality falls back to a transparent heuristic.")
        print("=" * 60)
        sys.exit(0)

    # ── Load data ────────────────────────────────────────────────────────
    if fmt == "csv":
        (X_train, y_train), (X_val, y_val) = load_fer_csv()
    else:
        (X_train, y_train), (X_val, y_val) = load_fer_folder()

    # ── Build model (import FacialCNN from facial_engine) ────────────────
    # We import from facial_engine to ensure architecture consistency
    try:
        from backend.ml.facial_engine import FacialCNN
    except ImportError:
        from ml.facial_engine import FacialCNN

    print("\n[3/7] Initialising FacialCNN...")
    torch.manual_seed(42)
    np.random.seed(42)

    model = FacialCNN()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3)
    criterion = nn.BCEWithLogitsLoss()

    # ── Training loop ────────────────────────────────────────────────────
    print(f"[4/7] Training for {epochs} epochs (batch_size={batch_size})...")

    X_train_t = torch.tensor(X_train, dtype=torch.float32)
    y_train_t = torch.tensor(y_train, dtype=torch.float32)
    X_val_t = torch.tensor(X_val, dtype=torch.float32)
    y_val_t = torch.tensor(y_val, dtype=torch.float32)

    best_val_auc = 0.0
    best_state = None

    for epoch in range(epochs):
        model.train()
        # Shuffle
        perm = torch.randperm(len(X_train_t))
        X_shuf = X_train_t[perm]
        y_shuf = y_train_t[perm]

        total_loss = 0.0
        n_batches = 0

        for start in range(0, len(X_shuf), batch_size):
            end = min(start + batch_size, len(X_shuf))
            xb = X_shuf[start:end]
            yb = y_shuf[start:end]

            optimizer.zero_grad()
            out = model(xb)
            loss = criterion(out, yb)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            n_batches += 1

        # Validation
        model.eval()
        with torch.no_grad():
            val_out = model(X_val_t)
            val_loss = criterion(val_out, y_val_t).item()
            val_probs = torch.sigmoid(val_out).numpy()
            val_preds = (val_probs >= 0.5).astype(int)

        val_acc = accuracy_score(y_val, val_preds)
        try:
            val_auc = roc_auc_score(y_val, val_probs)
        except ValueError:
            val_auc = 0.0

        scheduler.step(val_loss)

        print(
            f"  Epoch {epoch + 1:2d}/{epochs} | "
            f"Train Loss: {total_loss / n_batches:.4f} | "
            f"Val Loss: {val_loss:.4f} | "
            f"Val Acc: {val_acc:.4f} | "
            f"Val AUC: {val_auc:.4f}"
        )

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            best_state = model.state_dict().copy()

    # ── Restore best ────────────────────────────────────────────────────
    if best_state is not None:
        model.load_state_dict(best_state)

    # ── Final evaluation ────────────────────────────────────────────────
    print("\n[5/7] Final evaluation on validation set...")
    model.eval()
    with torch.no_grad():
        val_out = model(X_val_t)
        val_probs = torch.sigmoid(val_out).numpy()
        val_preds = (val_probs >= 0.5).astype(int)

    acc = accuracy_score(y_val, val_preds)
    prec = precision_score(y_val, val_preds, zero_division=0)
    rec = recall_score(y_val, val_preds, zero_division=0)
    f1 = f1_score(y_val, val_preds, zero_division=0)
    try:
        auc = roc_auc_score(y_val, val_probs)
    except ValueError:
        auc = 0.0

    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1:        {f1:.4f}")
    print(f"  AUC-ROC:   {auc:.4f}")

    # ── Save checkpoint ─────────────────────────────────────────────────
    print("\n[6/7] Saving checkpoint...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODEL_DIR / "facial_model.pt"
    torch.save(model, model_path)
    print(f"  Saved model → {model_path}")

    # ── Save metadata (required by facial_engine for provenance) ────────
    meta_path = MODEL_DIR / "facial_cnn_metadata.json"
    metadata = {
        "dataset": "FER-2013 (proxy — NOT ASD-specific)",
        "dataset_url": "https://www.kaggle.com/datasets/msambare/fer2013",
        "binary_reframing": "Neutral=reduced_affect (1), Others=typical (0)",
        "limitation": (
            "FER-2013 is a general-purpose facial-expression dataset. "
            "Its relevance to ASD screening has not been clinically validated. "
            "Scores from this model are preliminary research signals only."
        ),
        "accuracy": round(acc, 4),
        "auc_roc": round(auc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": lr,
        "architecture": "FacialCNN (2-layer Conv2d, 128x128 input)",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  Saved metadata → {meta_path}")

    print(f"\n[7/7] Training complete!")
    print(f"  ⚠  DISCLOSURE: This model was trained on FER-2013 (proxy dataset).")
    print(f"     It is NOT trained on ASD-specific facial data.")
    print(f"     Scores are research-grade and must be transparently disclosed.\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train NeuroSense Facial CNN on FER-2013 (proxy dataset)."
    )
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    args = parser.parse_args()

    train(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
