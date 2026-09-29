# NeuroSense

NeuroSense is a triple-track multimodal ASD **screening** platform (not a diagnostic tool).
It covers `adult`, `child`, and `toddler` categories across a Vite/React frontend and
FastAPI backend with MongoDB Atlas persistence.

> **Clinical disclaimer.** NeuroSense is a research-grade screening aid.
> Results must not be used for clinical diagnosis without review by a qualified professional.

---

## Architecture

### System overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NeuroSense Pipeline                             │
│                                                                         │
│  Browser (React / Vite)                                                 │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ AQ-10 /  │  │ GazeSession│  │ SpeechSession│  │  FacialSession   │  │
│  │ Q-CHAT-10│  │(WebGazer.js│  │ (MediaRecorder│  │ (webcam snapshot)│  │
│  │ wizard   │  │ /MediaPipe)│  │  + base64)   │  │    + base64)     │  │
│  └────┬─────┘  └─────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │
│       │              │                │                   │             │
│  POST /screening/screen ──────────────────────────────────────────────▶ │
│                                                                         │
│  Backend (FastAPI)                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              preprocessing_pipeline.preprocess_screening_input()│   │
│  │  ┌───────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────┐ │   │
│  │  │ preprocessor  │ │ gaze_engine  │ │speech_engine│ │facial  │ │   │
│  │  │ .preprocess   │ │.compute_gaze │ │.compute_    │ │_engine │ │   │
│  │  │ _for_inference│ │_score()      │ │speech_score │ │.compute│ │   │
│  │  │               │ │              │ │()           │ │_facial │ │   │
│  │  │  tabular      │ │  gaze dict   │ │ speech dict │ │_score()│ │   │
│  │  └───────┬───────┘ └──────┬───────┘ └──────┬──────┘ └───┬────┘ │   │
│  │          │                │                │            │      │   │
│  │          ▼                └────────────────┴────────────┘      │   │
│  │  model.predict()                         fusion_engine.fuse()   │   │
│  │  (questionnaire ML)                      weighted avg of        │   │
│  │                                          trained modalities     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Modality status (per is_trained_model contract)

| Modality | Method | is_trained_model | Training data | Fusion weight |
|---|---|---|---|---|
| **Questionnaire** | Supervised ML (AdaBoost/XGBoost/RF) | `True` | UCI / Kaggle ASD screening datasets | 40% |
| **Gaze** | BiLSTM on browser-derivable features `[x, y, speed, is_fixation]` (`gaze_lstm_browser.pt`, trained by `backend/data/train_gaze_browser.py`); no heuristic fallback — unavailable sessions are excluded from fusion | `True` / unavailable | Cilia et al. (2022) hardware eye-tracking data (57 children). Not validated on webcam gaze. | 20% |
| **Speech** | 1D-CNN (if `speech_cnn.pt` present) / prosody heuristic (Bone et al. 2014) | `True`¹ / `False` | Synthetic MFCC proxy (no real ASD-labelled speech data in this repo) | 20% |
| **Facial** | 2D-CNN (if `facial_model.pt` present) / pixel-stat heuristic | `False` (no checkpoint yet) | FER-2013 proxy (general-purpose expression dataset — NOT ASD-specific)² | 20% |

¹ The speech CNN checkpoint currently in `backend/models/speech_cnn.pt` is a **synthetic proxy**
trained on MFCC arrays with planted statistical differences. `is_trained_model=False` is set in
the inference result and the interpretation string discloses this explicitly.

² `facial_model.pt` is not committed to this repository. Until it is present, `facial_engine`
always falls back to the pixel-stat heuristic with `is_trained_model=False`.

**Fusion rule.** `final_probability` is the weighted average of **only the modalities with
`is_trained_model=True`**. Heuristic-only modalities are excluded from `final_probability`
and appear only in `heuristic_signal` and `modality_breakdown` for transparency.

---

### Frontend

| File | Purpose |
|---|---|
| `src/pages/Screening.jsx` | Category-first wizard. Adult/child: 7-step flow (Track → Consent → Demographics → AQ-10 → Gaze → Speech → Facial → Review). Toddler: 5-step (no gaze/speech/facial). |
| `src/components/GazeSession.jsx` | 30 s webcam fixation task (WebGazer.js / MediaPipe) |
| `src/components/SpeechSession.jsx` | 20 s mic recording with amplitude visualiser |
| `src/components/FacialSession.jsx` | Webcam snapshot for facial expression analysis |
| `src/pages/Results.jsx` | Per-modality breakdown, SHAP/LIME panels, fusion formula |
| `src/pages/Diagnostic.jsx` | Developer-only page at `/app/diagnostic` with 6 test sections including a 4-modality smoke test |
| `src/data/screeningContent.js` | Central copy, question wording, validation helpers |
| `src/data/mockData.js` | Seeded adult/child/toddler records with multimodal data |

### Backend

| File | Purpose |
|---|---|
| `backend/ml/preprocessing_pipeline.py` | **Unified preprocessing entry-point.** Dispatches to all 4 per-modality functions and returns `PreprocessedInput`. No ML logic — pure structural aggregation. |
| `backend/ml/preprocessor.py` | Tabular feature engineering for questionnaire ML (AQ-10 / Q-CHAT-10 → feature vector) |
| `backend/ml/gaze_engine.py` | Fixation scoring. Heuristic (Jones & Klin 2013) with LSTM hot-swap via `backend/models/gaze_lstm.pt` |
| `backend/ml/speech_engine.py` | MFCC / prosody scoring (Bone et al. 2014) with 1D-CNN hot-swap via `backend/models/speech_cnn.pt` |
| `backend/ml/facial_engine.py` | Facial expression risk scoring with 2D-CNN hot-swap via `backend/models/facial_model.pt` |
| `backend/ml/cv_preprocessing.py` | OpenCV face detection (DNN → Haar → centre-crop) + CLAHE normalisation, called by `facial_engine` before CNN inference |
| `backend/ml/fusion_engine.py` | Genuine multimodal late fusion: fixed calibrated weights (Q=40 %, G=20 %, S=20 %, F=20 %). Only trained modalities contribute to `final_probability`. |
| `backend/ml/model.py` | Category-aware questionnaire ML model registry (adult / child / toddler) |
| `backend/routers/screening.py` | Screening submission endpoint. Calls `preprocess_screening_input()` then `fuse()`. |
| `backend/routers/explainability.py` | SHAP / LIME explanations per case |
| `backend/routers/cases.py` | Case list, detail, and dashboard aggregation |
| `backend/core/categories.py` | Category registry, age validation, interpretation copy |
| `backend/core/cases_store.py` | Case normalisation, MongoDB persistence, JSON fallback |
| `backend/data/train_model.py` | Questionnaire ML training (adult / child / toddler) |
| `backend/data/train_gaze_lstm.py` | Gaze LSTM training (synthetic proxy) |
| `backend/data/train_speech_cnn.py` | Speech 1D-CNN training (real ASD data preferred; synthetic proxy if absent) |
| `backend/data/train_facial_cnn.py` | Facial 2D-CNN training (FER-2013 proxy; ASD-specific data preferred) |

---

## API contract

### `POST /screening/screen`

```json
{
  "category": "adult",
  "demo": {
    "subjectName": "Jordan A.",
    "respondentName": "Jordan A.",
    "respondentRelationship": "Self",
    "age": 34,
    "gender": "Non-binary",
    "ethnicity": "South Asian",
    "jaundice": "No",
    "familyAsd": "Yes"
  },
  "answers": { "A1": "Definitely agree" },
  "aq10Score": 8,
  "gazePoints": [{"x": 0.5, "y": 0.3, "timestamp": 1714300000, "stimulus": 0}],
  "gazeSkipped": false,
  "audioBase64": "UklGRi...",
  "audioMimeType": "audio/webm",
  "transcriptHint": "The quick brown fox...",
  "speechSkipped": false,
  "facialImageBase64": "/9j/4AAQ...",
  "facialSkipped": false
}
```

### Key response fields

| Field | Type | Description |
|---|---|---|
| `caseId` | string | Unique case identifier |
| `riskLevel` | `"High"` \| `"Moderate"` \| `"Low"` | Driven by `final_probability` |
| `fusionScore` | float | Weighted avg of trained modalities only |
| `questionnaireProbability` | float | P(ASD) from questionnaire ML model |
| `heuristicSignal` | float \| null | Weighted avg of heuristic-only modalities (supplemental) |
| `confidenceNote` | string | Plain-English description of which modalities contributed |
| `modalityBreakdown.components` | array | One entry per modality with `score`, `isTrainedModel`, `method` |
| `modalities_used` | int | Count of modalities with a score (1–4) |

---

## Running the app

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The frontend expects the backend at `http://localhost:8000`.

---

## Model training

### Questionnaire models (required)

```bash
python3 -m backend.data.train_model --category adult
python3 -m backend.data.train_model --category child
python3 -m backend.data.train_model --category toddler
```

Outputs: `backend/ml/model_{category}.pkl`, `encoders_{category}.pkl`, `background_{category}.npy`

### Auxiliary modality models (optional — enable hot-swap)

```bash
# Gaze LSTM (synthetic proxy unless you supply a labelled gaze dataset)
python3 -m backend.data.train_gaze_lstm

# Speech 1D-CNN (auto-detects real data at backend/data/speech_dataset/, else synthetic proxy)
python3 -m backend.data.train_speech_cnn

# Facial 2D-CNN (FER-2013 proxy; see backend/data/train_facial_cnn.py for ASD dataset instructions)
python3 -m backend.data.train_facial_cnn
```

Dropping the resulting `*.pt` files into `backend/models/` automatically activates the trained
models on the next server restart — no code changes needed.

---

## Verification

```bash
npm run lint
npm run build
PYTHONPATH=. pytest backend/tests/
python3 -c "from backend.main import app; print(app.title)"
```

---

## Mock mode

If the backend is unavailable, the frontend falls back to seeded mock cases and preserves
category badges, model/data-source tags, and result payload shapes. Mock submissions are saved
in browser storage so new demo cases appear in the case list, dashboard, and results pages.

---

## Modality maturity — honest status

| Modality | Status | Notes |
|---|---|---|
| Questionnaire | ✅ Production-ready | Trained on real ASD screening data (UCI / Kaggle); participant-split validation |
| Gaze | ⚠️ Research heuristic | No clinically labelled gaze+ASD dataset committed; LSTM checkpoint is a synthetic proxy |
| Speech | ⚠️ Synthetic proxy | 1D-CNN checkpoint trained on synthetic MFCCs; `is_trained_model=False` in API response |
| Facial | ⚠️ Heuristic only | No `facial_model.pt` committed; pixel-stat heuristic active; `is_trained_model=False` |

Heuristic scores appear in `modality_breakdown` for transparency but **do not affect
`final_probability` or `riskLevel`** under the current fusion strategy.
