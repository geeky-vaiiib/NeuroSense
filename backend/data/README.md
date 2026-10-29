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

## Label leakage — READ THIS BEFORE TRUSTING ANY QUESTIONNAIRE METRIC

Dropping the `result` / `Qchat-10-Score` columns is **not enough**. In all three datasets the class label is a
deterministic function of the item total, which the item columns still contain:

| Dataset | Rule that reproduces the label | Rows reproduced | Total alone, AUC | Item-free model (demographics/history), CV AUC |
|---|---|---|---|---|
| Adult | total of A1-A10 >= 7 | 704 / 704 | 1.000 | 0.70 |
| Child | total of A1-A10 >= 7 | 292 / 292 | 1.000 | 0.58 |
| Toddler | total of A1-A10 >= 4 | 1054 / 1054 | 1.000 | 0.65 |

The shipped models agree with that rule on 99.7% (adult), 95.5% (child) and 99.6% (toddler) of rows, and 94-99% of
the variance of their predicted probability is explained by the total alone. They have learned the scoring rule, so
their accuracy / AUC / calibration are **not** evidence about clinical status, and the "probability" is not an
independently validated probability. Verify with `python -m backend.data.audit_questionnaire_labels`
(results: `backend/reports/questionnaire_label_audit.json`); `train_model.py` now prints a leakage warning when the
agreement is >= 99%. The thresholds are the dataset providers' labelling rule; instrument manuals may quote a different
cut-off. The app therefore shows the total score, the rule's threshold and a plain notice next to the model output
(`backend/ml/questionnaire_score.py`).

To make this model meaningful you need labels that do not come from the items (e.g. clinician-confirmed diagnoses)
and participant-level evaluation; do not invent or relabel data.

Other columns dropped by `train_model.py`: Adult / Child `result` (sum of A1-A10); Toddler `Qchat-10-Score`, `Case_No`, `Who completed the test`.

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
