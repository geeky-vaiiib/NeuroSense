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

---

## Authentication & authorization

**Architecture.** The FastAPI backend is the only authority: it hashes passwords (Argon2id), signs and verifies JWTs, and resolves the current user from MongoDB on every request. The browser never creates, sees or stores a credential.

```
POST /auth/login → verify Argon2id hash → sign JWT (HS256) → Set-Cookie ns_session (HttpOnly, SameSite=Lax)
request + cookie → get_current_user(): verify signature/exp/iss/aud/jti → not revoked → user row exists & is_active
                 → CurrentUser(user_id, role from DB) → query scoped by user_id → response
```

**Session/token.** Access JWT in an `HttpOnly` cookie (`Secure` when `COOKIE_SECURE=true`), lifetime `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default 60), no refresh token: an expired session means logging in again. Claims: `sub, email, role, iat, nbf, exp, iss, aud, jti` only. `POST /auth/logout` stores the `jti` in `revoked_tokens` (TTL index) so a copied token dies too. Non-browser clients may send `Authorization: Bearer <jwt>`. Cookie-authenticated writes must also send `X-Requested-With: NeuroSense` (CSRF defence; the CORS allow-list blocks other origins from sending it). Trade-off: HttpOnly cookies keep the token away from XSS; the cost is that CSRF must be handled (done as above).

**Users** (`users` collection): `user_id, name, email (lower-cased, unique index idx_user_email_unique), password_hash, role (user|clinician), created_at, updated_at, is_active`. Registration always creates role `user`; a `role` field in the request is rejected. Promote an account on a trusted machine: `python3 -m backend.scripts.manage_users set-role --email x@y.z --role clinician`. Password policy: 10–128 chars with a letter and a digit. Failed logins are throttled (5 per 15 min per IP+email, in-process).

**Endpoints.**

| Route | Access |
|---|---|
| `GET /`, `POST /auth/register`, `POST /auth/login` | public |
| `GET /auth/me`, `POST /auth/logout`, `POST /gaze/analyze`, `GET /gaze/status`, `POST /screening/screen`, `GET /cases/`, `GET /cases/{id}`, `GET /cases/dashboard/summary`, `GET /explain/{id}` | authenticated |
| role-restricted | none yet; `require_roles("clinician")` is available |

**Ownership.** Every case stores `user_id` taken from the verified token (never from the request). Lists, dashboard and detail queries filter by `user_id` in MongoDB; another user's case returns `404 Case not found` (same as a missing one). `/explain/{id}` checks ownership before any model work. Cases created before authentication have no `user_id`; they are visible to nobody until an operator runs `manage_users assign-legacy-cases --email owner@x --yes` (dry run without `--yes`).

**Indexes.** `users.email` (unique), `users.user_id` (unique), `cases.user_id+screening_date`, `revoked_tokens.jti` (unique) and `revoked_tokens.expires_at` (TTL), plus the existing case indexes.

**Environment** (`backend/.env`, see `backend/.env.example`): `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET` (required, ≥32 random chars — startup fails otherwise), `JWT_ALGORITHM`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_ISSUER`, `JWT_AUDIENCE`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `CORS_ALLOWED_ORIGINS` (explicit origins, `*` rejected). Frontend: optional `VITE_API_URL`.

**Local setup.** `cp backend/.env.example backend/.env`, fill `MONGODB_URI` and a generated `JWT_SECRET`, start the backend, then register an account on `/auth`. There are no built-in accounts.

**Tests.** `PYTHONPATH=backend python3 -m pytest backend/tests` (uses an in-memory MongoDB; never touches Atlas) and `npm test`.

### Failure behaviour (no synthetic results)
The frontend has **no mock mode**: `src/data/mockData.js` and every network-failure fallback were removed. A failed request surfaces as an `ApiError` (`unauthenticated` 401, `forbidden` 403, `not_found` 404, `validation` 422, `server` 5xx, `network`, `timeout`) and the page shows it. If the questionnaire model is not loaded the server answers `503` instead of estimating a probability (`NEUROSENSE_ALLOW_MOCK_INFERENCE=true` re-enables the old AQ-10 estimate for local development only). Unavailable modalities (gaze, speech, facial) are reported as unavailable and excluded from fusion.

### Legacy cases (created before accounts)
They have no `user_id`, are preserved, and are invisible to every account. An administrator assigns them deliberately, to one known owner:
```bash
python3 -m backend.scripts.manage_users legacy-cases                                   # count
python3 -m backend.scripts.manage_users assign-legacy-cases --email owner@x.org        # dry run
python3 -m backend.scripts.manage_users assign-legacy-cases --email owner@x.org --yes  # write
```

### Login throttle limitation
5 failed attempts per IP+email per 15 minutes, held in process memory: it resets on restart, is per worker, and is not suitable for multi-instance deployments (use a shared store such as Redis there).

### Local development
```bash
uvicorn backend.main:app --reload --port 8000     # backend (needs backend/.env with MONGODB_URI and JWT_SECRET)
npm run dev                                       # frontend on http://localhost:5173
PYTHONPATH=backend python3 -m pytest backend/tests  # backend tests (in-memory MongoDB)
npm test && npm run lint && npm run build           # frontend
```


---

## Gaze pipeline (browser -> backend)

```
camera (getUserMedia) -> MediaPipe FaceMesh (vendored, 478 landmarks incl. iris) -> features [gx, gy, yaw, pitch, cx, cy]
  -> 9-point auto calibration (ridge regression, leave-one-target-out quality) -> 30 s task, one sample per tracked frame
  -> POST /gaze/analyze (canonical samples: timestamp, x, y, stimulus_id, face_detected)
  -> backend: validation -> I-DT fixations -> 10 Hz resample -> [x, y, speed, is_fixation] -> BiLSTM -> probability
```
- **Code:** `src/gaze/` (landmarks, mapper, calibration, filters, tracker), `src/components/GazeSession.jsx`, `backend/ml/gaze/`.
- **Requirements:** Chrome or Edge; `http://localhost` or HTTPS (camera access is blocked on plain-HTTP remote origins). WebGazer is no longer used.
- **Calibration quality** = 0.75 x accuracy + 0.25 x validity; accepted when >= 8/9 targets have >= 10 clean frames and the leave-one-target-out error is <= 12 % of the screen diagonal (constants and rationale in `src/gaze/calibration.js`). It is a technical usability indicator, not a clinical measure. Skipping is offered only after 3 failed attempts (or immediately for unrecoverable conditions such as a denied camera or an unavailable model); every reason is stored and shown on the report.
- **Model status:** `GET /gaze/status` (authenticated) and `modalities.gaze_detail` on `GET /`. The gaze step checks it first and refuses to start if the model cannot run. The backend interpreter needs `torch` (`pip install -r backend/requirements.txt`).
- **Debug overlay (development builds only):** open the app with `?gazeDebug=1` (or `localStorage.ns_gaze_debug = "1"`): FPS, landmark count, feature vector and order, valid samples, calibration score, model status; every landmark is drawn on the preview.
