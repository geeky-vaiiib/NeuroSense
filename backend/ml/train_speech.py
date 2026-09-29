"""Training script for Speech 1D-CNN (blocked by dataset availability)."""

import json
import os
import random
from datetime import datetime
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
import librosa

# Dataset path definition
DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "speech_dataset"

# ── Model Architecture ────────────────────────────────────────────────────────
class SpeechCNN(nn.Module):
    """Simple 1D CNN for MFCCs expecting (batch, 13, T)."""
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv1d(13, 32, kernel_size=3, padding=1)
        self.relu1 = nn.ReLU()
        self.pool1 = nn.MaxPool1d(2)
        
        self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=1)
        self.relu2 = nn.ReLU()
        self.pool2 = nn.AdaptiveAvgPool1d(1) # Handles variable length T
        
        self.fc = nn.Linear(64, 1)

    def forward(self, x):
        x = self.conv1(x)
        x = self.relu1(x)
        x = self.pool1(x)
        
        x = self.conv2(x)
        x = self.relu2(x)
        x = self.pool2(x) # (batch, 64, 1)
        
        x = x.squeeze(2)
        x = self.fc(x)
        return x.squeeze(1)


# ── Dataset Definition ────────────────────────────────────────────────────────
class ASDSpeechDataset(Dataset):
    """
    Expected dataset structure:
    backend/data/speech_dataset/
        metadata.csv (columns: participant_id, file_name, label (1=ASD, 0=TD))
        audio/
            participant1_01.wav
            participant1_02.wav
            participant2_01.wav
    """
    def __init__(self, data_list):
        self.data_list = data_list

    def __len__(self):
        return len(self.data_list)

    def __getitem__(self, idx):
        item = self.data_list[idx]
        file_path = item["file_path"]
        label = item["label"]
        
        # Exact preprocessing as speech_engine.py
        y, sr = librosa.load(file_path, sr=22050, mono=True, duration=25.0)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        tensor = torch.tensor(mfccs, dtype=torch.float32)
        
        return tensor, torch.tensor([label], dtype=torch.float32)


def collate_fn(batch):
    """Pad sequences in a batch to the same length."""
    tensors, labels = zip(*batch)
    max_len = max([t.shape[1] for t in tensors])
    
    padded_tensors = []
    for t in tensors:
        pad_amount = max_len - t.shape[1]
        padded = nn.functional.pad(t, (0, pad_amount))
        padded_tensors.append(padded)
        
    return torch.stack(padded_tensors), torch.stack(labels)


# ── Training & Validation ─────────────────────────────────────────────────────
def train_model():
    # 1. Strict guard: Check if dataset exists
    if not DATASET_PATH.exists() or not (DATASET_PATH / "metadata.csv").exists():
        print("BLOCKED: No ASD-labelled speech dataset found.")
        print(f"Expected dataset at: {DATASET_PATH}")
        print("Aborting training to prevent data fabrication.")
        exit(1)
        
    # Set reproducible seed
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)
    
    # 2. Load dataset metadata (Implementation omitted since blocked)
    # The loading logic must group by participant_id and split into 
    # train/val without data leakage across participants.
    # train_data, val_data = load_and_split_metadata(DATASET_PATH)
    
    train_data = [] # placeholder
    val_data = [] # placeholder
    
    train_dataset = ASDSpeechDataset(train_data)
    val_dataset = ASDSpeechDataset(val_data)
    
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, collate_fn=collate_fn)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, collate_fn=collate_fn)
    
    model = SpeechCNN()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3)
    
    # Calculate pos_weight for class imbalance if necessary
    # pos_weight = total_neg / total_pos
    criterion = nn.BCEWithLogitsLoss()
    
    print("Training 1D-CNN on legitimate dataset...")
    epochs = 50
    best_val_auc = 0.0
    patience = 5
    patience_counter = 0
    
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        
        for x, y in train_loader:
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        # Validation
        model.eval()
        preds, probs, trues = [], [], []
        val_loss = 0.0
        with torch.no_grad():
            for x, y in val_loader:
                out = model(x)
                loss = criterion(out, y)
                val_loss += loss.item()
                
                prob = torch.sigmoid(out).cpu().numpy()
                probs.extend(prob)
                preds.extend((prob >= 0.5).astype(int))
                trues.extend(y.cpu().numpy())
                
        # Metrics
        auc = roc_auc_score(trues, probs)
        print(f"Epoch {epoch+1}/{epochs} | Train Loss: {total_loss/len(train_loader):.4f} | Val Loss: {val_loss/len(val_loader):.4f} | Val AUC: {auc:.4f}")
        
        scheduler.step(val_loss)
        
        # Early Stopping
        if auc > best_val_auc:
            best_val_auc = auc
            patience_counter = 0
            # Save best checkpoint
            out_dir = Path(__file__).resolve().parent.parent / "models"
            out_dir.mkdir(parents=True, exist_ok=True)
            torch.save(model, out_dir / "speech_cnn.pt")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print("Early stopping triggered.")
                break

    # Save metadata
    acc = accuracy_score(trues, preds)
    prec = precision_score(trues, preds, zero_division=0)
    rec = recall_score(trues, preds, zero_division=0)
    f1 = f1_score(trues, preds, zero_division=0)
    cm = confusion_matrix(trues, preds)
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    metadata = {
        "architecture": "SpeechCNN_1D",
        "feature_order": ["MFCC_13"],
        "preprocessing_version": "librosa_22050_25s",
        "sample_rate": 22050,
        "input_dimensions": "(batch, 13, T)",
        "labels": {"0": "Typical", "1": "ASD"},
        "threshold": 0.5,
        "dataset_identifier": "ASD_Speech_Dataset_V1",
        "model_version": "1.0",
        "training_seed": 42,
        "training_date": datetime.now().isoformat(),
        "evaluation_metrics": {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1_score": f1,
            "roc_auc": best_val_auc,
            "sensitivity": sensitivity,
            "specificity": specificity
        }
    }
    
    with open(out_dir / "speech_cnn_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"\nSaved metadata to {out_dir / 'speech_cnn_metadata.json'}")

if __name__ == "__main__":
    train_model()
