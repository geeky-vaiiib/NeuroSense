#!/usr/bin/env python3
"""
ml/train_facial.py — Re-exports from the canonical training script.

The actual training logic lives in backend/data/train_facial_cnn.py.
This file exists for backward compatibility with any workflows that
reference backend/ml/train_facial.py.

Usage:
  cd backend/
  python -m ml.train_facial          # equivalent to python -m data.train_facial_cnn
  python -m data.train_facial_cnn    # preferred
"""

import sys
from pathlib import Path

# Ensure backend/ is on sys.path for imports
_backend = str(Path(__file__).resolve().parent.parent)
if _backend not in sys.path:
    sys.path.insert(0, _backend)

try:
    from backend.data.train_facial_cnn import train
except ImportError:
    from data.train_facial_cnn import train

if __name__ == "__main__":
    train()
