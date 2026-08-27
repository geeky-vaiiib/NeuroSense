# NeuroSense — Dataset Setup

## Required Files

Place these CSV files in the `backend/data/` directory:

### 1. Adult Dataset

| Property | Value |
|---|---|
| **File** | `asd_screening_adult.csv` |
| **Source** | [UCI ML Repository (ID: 426)](https://archive.ics.uci.edu/dataset/426) |
| **Records** | 704 |
| **Tool** | AQ-10 |
| **Target** | `Class/ASD` |

**Download (Python):**

```python
from ucimlrepo import fetch_ucirepo

adult = fetch_ucirepo(id=426)
df = adult.data.features.join(adult.data.targets)
df.to_csv('asd_screening_adult.csv', index=False)
```

### 2. Child Dataset

| Property | Value |
|---|---|
| **File** | `asd_screening_child.csv` |
| **Source** | [UCI ML Repository (ID: 419)](https://archive.ics.uci.edu/dataset/419) |
| **Records** | 292 |
| **Tool** | AQ-10 Child |
| **Target** | `Class/ASD` |

**Download (Python):**

```python
from ucimlrepo import fetch_ucirepo

child = fetch_ucirepo(id=419)
df = child.data.features.join(child.data.targets)
df.to_csv('asd_screening_child.csv', index=False)
```

### 3. Toddler Dataset

| Property | Value |
|---|---|
| **File** | `asd_screening_toddler.csv` |
| **Source** | [Kaggle — fabdelja/autism-screening-for-toddlers](https://www.kaggle.com/datasets/fabdelja/autism-screening-for-toddlers) |
| **Records** | 1054 |
| **Tool** | Q-CHAT-10 |
| **Target** | `Class/ASD Traits` |

**Download via Kaggle CLI:**

```bash
pip install kaggle
# Set up ~/.kaggle/kaggle.json first (from kaggle.com/settings → API)
kaggle datasets download -d fabdelja/autism-screening-for-toddlers --unzip
mv "Toddler Autism dataset July 2018.csv" asd_screening_toddler.csv
```

---

## Key Structural Difference — Toddler Dataset

The toddler dataset uses **different column names** from adult/child:

| Adult / Child Column | Toddler Column |
|---|---|
| `A1_Score` – `A10_Score` | `A1` – `A10` |
| `age` (years) | `Age_Mons` (months) |
| `gender` | `Sex` |
| `austism` / `family_pdd` / `autism` | `Family_mem_with_ASD` |
| `Class/ASD` | `Class/ASD Traits` |

> **Do not rename columns manually.** The training script (`train_model.py`) handles all column normalisation automatically.

---

## Leakage Columns — MUST Be Dropped

These columns are **automatically dropped** by `train_model.py`. If they are NOT dropped, models achieve 100% accuracy through data leakage — not genuine learning.

| Dataset | Leakage Columns |
|---|---|
| Adult / Child | `result` (sum of A1–A10 scores) |
| Toddler | `Qchat-10-Score`, `Case_No`, `Who completed the test` |

---

## Training Commands

```bash
cd /path/to/NeuroSense
pip install -r backend/requirements.txt

# Train all three models
python -m backend.data.train_model

# Or train individually
python -m backend.data.train_model --category adult
python -m backend.data.train_model --category child
python -m backend.data.train_model --category toddler
```

---

## Expected Output Artifacts

After training, these files are written to `backend/ml/`:

```
backend/ml/model_adult.pkl
backend/ml/encoders_adult.pkl
backend/ml/background_adult.npy

backend/ml/model_child.pkl
backend/ml/encoders_child.pkl
backend/ml/background_child.npy

backend/ml/model_toddler.pkl
backend/ml/encoders_toddler.pkl
backend/ml/background_toddler.npy
```

---

## Running Without Trained Models

The system falls back to **mock inference** automatically when `.pkl` files are not found. The Results page shows a "mock mode" badge when running in this state. Mock mode uses AQ-10/Q-CHAT-10 sum scores as a rough probability proxy — it is not a real ML prediction.
