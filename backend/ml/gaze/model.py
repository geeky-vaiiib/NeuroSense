"""Small BiLSTM window classifier for OpenFace gaze sequences + checkpoint loading."""

from __future__ import annotations

import json
from pathlib import Path

import torch
import torch.nn as nn

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
CHECKPOINT_PATH = MODELS_DIR / "gaze_openface_dasd.pt"
METADATA_PATH = MODELS_DIR / "gaze_openface_dasd_metadata.json"


class GazeBiLSTM(nn.Module):
    """(B, L, F) -> logit (B,).  Deliberately small: DASD has only 82 participants."""

    def __init__(self, input_size: int, hidden_size: int = 32, dropout: float = 0.4):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, batch_first=True, bidirectional=True)
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size * 4, 1)     # mean-pool + max-pool of BiLSTM states

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h, _ = self.lstm(x)
        z = torch.cat([h.mean(1), h.max(1).values], dim=1)
        return self.fc(self.dropout(z)).squeeze(1)


def load_checkpoint(path: Path = CHECKPOINT_PATH, meta_path: Path = METADATA_PATH):
    """-> (model.eval(), metadata dict).  Raises FileNotFoundError / ValueError."""
    if not Path(path).exists() or not Path(meta_path).exists():
        raise FileNotFoundError(f"gaze checkpoint or metadata missing: {path}")
    meta = json.loads(Path(meta_path).read_text())
    ckpt = torch.load(path, map_location="cpu", weights_only=True)
    arch = meta["architecture"]
    model = GazeBiLSTM(arch["input_size"], arch["hidden_size"], arch["dropout"])
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return model, meta
