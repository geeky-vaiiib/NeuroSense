"""BiLSTM gaze classifier and checkpoint helpers (top-level so state_dict loads cleanly)."""

from __future__ import annotations

from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.utils.rnn as rnn_utils


class GazeLSTM(nn.Module):
    def __init__(
        self,
        input_size: int = 5,
        hidden_size: int = 64,
        num_layers: int = 2,
        lstm_dropout: float = 0.3,
        fc_dropout: float = 0.4,
    ):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=lstm_dropout,
            bidirectional=True,
        )
        self.bn      = nn.BatchNorm1d(hidden_size * 2)
        self.dropout = nn.Dropout(fc_dropout)
        self.fc      = nn.Linear(hidden_size * 2, 1)

    def forward(self, x, lengths):
        packed = rnn_utils.pack_padded_sequence(
            x, lengths.cpu(), batch_first=True, enforce_sorted=False
        )
        _, (h, _) = self.lstm(packed)
        h_cat = torch.cat([h[-2], h[-1]], dim=1)   # last-layer fwd + bwd states
        h_cat = self.bn(h_cat)
        h_cat = self.dropout(h_cat)
        return self.fc(h_cat).squeeze(1)


ARCH_KEYS = ("input_size", "hidden_size", "num_layers", "lstm_dropout", "fc_dropout")


def load_gaze_lstm(path: str | Path) -> tuple[GazeLSTM, dict]:
    """Rebuild GazeLSTM from a state-dict checkpoint. Returns (model.eval(), checkpoint)."""
    ckpt = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(ckpt, dict) or "model_state_dict" not in ckpt:
        raise ValueError(f"{path} is not a state-dict checkpoint")
    model = GazeLSTM(**{k: ckpt[k] for k in ARCH_KEYS if k in ckpt})
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return model, ckpt
