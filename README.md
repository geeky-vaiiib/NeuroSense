# NeuroSense

NeuroSense is an **ASD screening aid** (not a diagnostic tool): a Vite/React frontend and a FastAPI backend with MongoDB persistence.
The screening result is a **server-computed questionnaire score compared with a threshold**. Eye-gaze, speech and facial
analyses are recorded as measurements or experimental outputs, are shown for transparency, and **never change the result**.

> **Clinical disclaimer.** NeuroSense is a research prototype. Nothing in it has been validated for clinical use; results must
> not be used for diagnosis without review by a qualified professional.

## How to read the status claims in this repository
Four different things are kept apart everywhere (README, UI, reports):

| level | meaning |
|---|---|
| **1 Implemented** | the code exists and runs |
| **2 Tested technically** | automated tests / manual runs show the code behaves as designed |
| **3 Evaluated on labelled data** | a model has been measured against labelled examples with a leakage-safe protocol |
| **4 Validated for the intended population** | evidence exists for the children/setting NeuroSense is meant for |

Nothing here reaches level 4. Only gaze reaches level 3 (82 children, DASD) and even there the evidence is weak (see below).

## What each component is (and is not)

| Component | L1 | L2 | L3 | L4 | Reality |
|---|---|---|---|---|---|
| **Questionnaire score** (child AQ-10 caregiver form; adult AQ-10) | yes | yes | no | no | Server scores the 10 items (`backend/ml/questionnaire_score.py`); result = total vs threshold; risk band is a presentation of the score, not a probability. The threshold is the rule found in the training labels (total ≥ 7), not verified against the instrument manual. Toddler (Q-CHAT-10) submissions are refused: its 5-point scale is not representable. |
| Questionnaire ML model (XGB/AdaBoost) | yes | yes | no | no | Trained on public datasets whose labels are a threshold on the item total (100% of rows; `backend/data/audit_questionnaire_labels.py`). It models the scoring rule, is shown for transparency / SHAP-LIME only, and does not affect the result. |
| **Eye gaze** (OpenFace → BiLSTM `gaze-openface-dasd-v3`; v2 frozen baseline) | yes | yes | weak | no | Experimental. Trained on DASD (82 children). Metadata alone (duration etc.) scores as well on the same folds; the model ignores temporal order; webcam adults sit far below the training movement range (`backend/reports/`). Displayed as experimental output + quality + movement statistics; excluded from the result. |
| **Speech** | measurement only | yes | no | no | Acoustic features (pitch, loudness, rate) are extracted and shown. **No classifier exists**: the old CNN was a synthetic proxy and the heuristic "flags" were removed. Status `model_unavailable`. |
| **Facial** | detection only | yes | no | no | Face detection + image quality. No landmarks, no expression model, no ASD classifier. Status `model_unavailable`. |
| Result contract (`ml/fusion_engine.py`) | yes | yes | no | no | Questionnaire only. No composite probability, no weights. Experimental / unavailable modalities are listed with their status and cannot enter. |
| Explanations | yes | yes | n/a | no | (1) per-item score explanation (decides the result); (2) SHAP/LIME of the questionnaire ML model (explains the model, not the result); (3) gaze feature-sensitivity (ablation), not causal. |

The modality status contract (`ml/modality_status.py`): `available_scoring_instrument`, `available_validated` (nothing qualifies today),
`available_experimental`, `insufficient_data`, `failed_quality`, `model_unavailable`, `analysis_failed`, `skipped`, `not_provided`.
An unavailable modality has `output: null` (never 0) and `in_result: false`.

## Architecture

```
Browser (React)  ──  POST /screening/screen  {demo, answers, gazeAnalysisId?, audio?, image?}   (no totals / risk levels / probabilities accepted)
Gaze: POST /gaze/analyze (30 s video) → job → OpenFace → quality + domain gates → model → stored job result (user-bound)
Backend:  validate (answers strictly, age range, category) → score_questionnaire() → ML model output (optional, labelled)
          → modality states (gaze job lookup by id, speech/face measured) → fusion_engine.combine() → persist case (owner = session user)
Results:  GET /cases/{id} (stored result, owner-scoped) · GET /explain/{id} (score explanation + SHAP/LIME status)
```

| File | Purpose |
|---|---|
| `backend/ml/questionnaire_score.py` | the only scoring implementation (strict answers, per-instrument trait items, thresholds, age ranges, risk band) |
| `backend/ml/modality_status.py`, `fusion_engine.py` | status contract and result contract (formula and eligibility documented in the module docstrings) |
| `backend/ml/preprocessing_pipeline.py` | measures speech/facial; never produces a score |
| `backend/ml/speech_engine.py`, `speech_features.py` | decoding + acoustic features; safe JSON classifier loader (no pickle); `data/train_speech_asd.py` needs a participant-labelled corpus |
| `backend/ml/facial_engine.py`, `cv_preprocessing.py` | face detection + image quality |
| `backend/ml/gaze/` | OpenFace gaze pipeline (below) |
| `backend/ml/shap_engine.py`, `lime_engine.py`, `routers/explainability.py` | SHAP/LIME for the questionnaire ML model; return `null`/"unavailable" instead of placeholder values |
| `backend/routers/screening.py`, `cases.py`, `core/cases_store.py` | submission, owner-scoped retrieval, history (stored records are never rewritten; pre-v2 cases are marked legacy) |
| `backend/models/quarantine/` | synthetic-proxy speech CNN, the fusion meta-classifier trained on *simulated* data, and the FER-2013 "ASD proxy" trainers: kept for provenance, never loaded |
| `src/components/results/` | `ScoreMeter`, `ModalityStatusGrid`, `ResultBasis`, `ExplanationPanel`, `SpeechMeasurements`, `GazeRecordingSummary` (render stored backend values only) |

## API: `POST /screening/screen`

```json
{ "category": "child",
  "demo": { "age": 7, "gender": "Male", "subjectName": "…", "respondentRelationship": "Parent", "jaundice": "No", "familyAsd": "No" },
  "answers": { "A1": "Definitely agree", "A2": "Slightly disagree", "…": "…", "A10": "Definitely disagree" },
  "gazeAnalysisId": "<job id from POST /gaze/analyze>", "gazeSkipped": false,
  "audioBase64": "…", "audioMimeType": "audio/webm", "speechSkipped": false, "facialImageBase64": "…", "facialSkipped": false }
```
Answers must be exactly one of the four options (case-insensitive); anything else, a missing item, age outside 4–11 (child) / 18+ (adult), or `category: "toddler"` is a 422 and nothing is stored.
`aq10Score` is still *accepted* for backwards compatibility but **ignored**; a differing value yields a warning. `riskLevel`, `fusionScore`, probabilities, user ids etc. in the body are ignored.

| Response field | Meaning |
|---|---|
| `aq10Score`, `questionnaireBasis` | server-computed total, threshold, band, per-item points, notice |
| `riskLevel`, `result` | the contract result (`basis: questionnaire_score_only`, `composite_probability: null`, `modalities_in_result`, `excluded[]`, formula) |
| `modalities[]` | status contract for questionnaire, gaze, speech, facial |
| `modelOutput`, `questionnaireProbability` | ML model output (nullable), explicitly not a validated probability |
| `fusionScore`, `heuristicSignal`, `modalityBreakdown` | **deprecated, always null** |
| `warnings[]` | e.g. client total mismatch, no ML model loaded |

## Running

```bash
cp backend/.env.example backend/.env        # set MONGODB_URI and a generated JWT_SECRET
python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt
uvicorn backend.main:app --port 8000        # frontend expects http://localhost:8000 (VITE_API_URL to change)
npm install && npm run dev                  # http://localhost:5173
scripts/dev_e2e_backend.sh                  # throw-away backend with an in-memory database, for local end-to-end checks
```
Requirements: Python 3.9+, MongoDB (or `mongomock://` for local testing), optional Docker with the amd64 `algebr/openface` image (or a native `FeatureExtraction`) for gaze; the camera/microphone need HTTPS or localhost. Production notes: `COOKIE_SECURE=true` with HTTPS origins, a Linux x86-64 host for OpenFace (emulated on Apple silicon), a shared store for throttling if multi-instance.
`GET /` reports the real state (version, database connectivity, per-modality status) and no secrets.
Known environment issue: the shipped questionnaire pickles were written with scikit-learn 1.6.1 / a newer XGBoost while `requirements.txt` pins 1.5.2 (an `InconsistentVersionWarning` appears); results were checked to load and explain, but re-exporting the models with the pinned versions is still to do.

## Training and audits (all reproducible; none of them is a clinical validation)

```bash
python3 -m backend.data.audit_questionnaire_labels       # label = item-total threshold in all three datasets
python3 -m backend.data.train_model --category child     # prints a leakage warning when labels are reconstructable from the items
python3 -m backend.data.audit_dasd | train_gaze_openface_dasd | compare_gaze_models | train_gaze_v3 | audit_gaze_leakage | benchmark_gaze_runtime
python3 -m backend.data.train_speech_asd --manifest corpus.csv --dataset-name … --license …   # refuses without a participant-labelled corpus
```

## Verification
```bash
PYTHONPATH=backend python3 -m pytest backend/tests -q      # backend (in-memory MongoDB; never touches a real database)
npm run lint && npm test && npm run build                  # frontend
```
Actual results of the last full run and the browser checks are recorded in `PROJECT_STATUS.md`.

---

## Authentication & authorization

**Architecture.** The FastAPI backend is the only authority: it hashes passwords (Argon2id), signs and verifies JWTs, and resolves the current user from MongoDB on every request. The browser never creates, sees or stores a credential.

```
POST /auth/login → verify Argon2id hash → sign JWT (HS256) → Set-Cookie ns_session (HttpOnly, SameSite=Lax)
request + cookie → get_current_user(): verify signature/exp/iss/aud/jti → not revoked → user row exists & is_active
                 → CurrentUser(user_id, role from DB) → query scoped by user_id → response
```

**Session/token.** Access JWT in an `HttpOnly` cookie (`Secure` when `COOKIE_SECURE=true`), lifetime `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default 60), no refresh token: an expired session means logging in again. Claims: `sub, email, role, iat, nbf, exp, iss, aud, jti` only. `POST /auth/logout` stores the `jti` in `revoked_tokens` (TTL index) so a copied token dies too. Non-browser clients may send `Authorization: Bearer <jwt>`. Cookie-authenticated writes must also send `X-Requested-With: NeuroSense` (CSRF defence; the CORS allow-list blocks other origins from sending it). Trade-off: HttpOnly cookies keep the token away from XSS; the cost is that CSRF must be handled (done as above).

**Users** (`users` collection): `user_id, name, email (lower-cased, unique index idx_user_email_unique), password_hash, role (user|clinician), created_at, updated_at, is_active`. Registration always creates role `user`; a `role` field in the request is rejected. Promote an account on a trusted machine: `python3 -m backend.scripts.manage_users set-role --email x@y.z --role clinician`. Password policy: 10–128 chars with a letter and a digit. Failed logins are throttled (5 per 15 min per IP+email) and account creation is capped (10 per hour per client), both in-process.

**Endpoints.**

| Route | Access |
|---|---|
| `GET /`, `POST /auth/register`, `POST /auth/login` | public |
| `GET /auth/me`, `POST /auth/logout`, `POST /gaze/analyze`, `GET /gaze/jobs/{id}`, `GET /gaze/status`, `POST /screening/screen`, `GET /cases/`, `GET /cases/{id}`, `GET /cases/dashboard/summary`, `GET /explain/{id}` | authenticated |
| role-restricted (`clinician`) | `GET/POST/DELETE /gaze/lab/*` and `keep_features` uploads (dev tool, also needs `GAZE_LAB_ENABLED=1`) |

**Ownership.** Every case stores `user_id` taken from the verified token (never from the request). Lists, dashboard and detail queries filter by `user_id` in MongoDB; another user's case returns `404 Case not found` (same as a missing one). `/explain/{id}` checks ownership before any model work. Cases created before authentication have no `user_id`; they are visible to nobody until an operator runs `manage_users assign-legacy-cases --email owner@x --yes` (dry run without `--yes`).

**Indexes.** `users.email` (unique), `users.user_id` (unique), `cases.user_id+screening_date`, `revoked_tokens.jti` (unique) and `revoked_tokens.expires_at` (TTL), plus the existing case indexes.

**Environment** (`backend/.env`, see `backend/.env.example`): `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET` (required, ≥32 random chars — startup fails otherwise), `JWT_ALGORITHM`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_ISSUER`, `JWT_AUDIENCE`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `CORS_ALLOWED_ORIGINS` (explicit origins, `*` rejected; an `https://` origin requires `COOKIE_SECURE=true`). Frontend: optional `VITE_API_URL`.

**Local setup.** `cp backend/.env.example backend/.env`, fill `MONGODB_URI` and a generated `JWT_SECRET`, start the backend, then register an account on `/auth`. There are no built-in accounts.

**Tests.** `PYTHONPATH=backend python3 -m pytest backend/tests` (uses an in-memory MongoDB; never touches Atlas) and `npm test`.

### Failure behaviour (no synthetic results)
There is no mock mode anywhere. A failed request is an `ApiError` the page shows; unavailable modalities are reported as such with `output: null`; a missing questionnaire ML model never blocks or alters the score-based result (the case simply has no model output and the explanation endpoint says so). The old `NEUROSENSE_ALLOW_MOCK_INFERENCE` fallback was removed.

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
uvicorn backend.main:app --reload --port 8000
npm run dev
```

---

## Gaze pipeline (browser recording -> server OpenFace -> trained model) — EXPERIMENTAL, not in fusion

```
camera (getUserMedia) -> 30 s MediaRecorder video -> POST /gaze/analyze (multipart, 202 + job id)
  -> server: re-encode at true fps -> OpenFace 2.x FeatureExtraction (-gaze -pose; Docker algebr/openface or native)
  -> quality gate -> 10 Hz grid, session-centred gaze angles (+ head pose for the gate) -> 6 s windows
  -> BiLSTM (gaze-openface-dasd-v3; v2 kept as frozen baseline) -> domain gate -> result
  -> GET /gaze/jobs/{id}   (honest stages: uploading / processing video / extracting features / running model)
```
- **Status:** the gaze classifier is an experimental research signal and is **excluded from the combined result**: it was trained on DASD (82 children, ADOS-2 labels, unknown stimulus), shows no evidence yet of beating recording-context controls, and has not been validated on webcam data. Quality and plain movement statistics are always shown; the probability is withheld when the recording is outside the training range. See `backend/reports/` (`gaze_model_selection_and_runtime.md`, `gaze_domain_diagnosis.md`, `leakage_audit/`).
- **Code:** `backend/ml/gaze/` (config, preprocess, openface, model, inference, quality, summary, service, jobs), `backend/routers/gaze.py`, `src/components/GazeSession.jsx`, `src/pages/GazeLab.jsx` (dev tool, `GAZE_LAB_ENABLED=1`).
- **OpenFace:** set `OPENFACE_BIN` (native `FeatureExtraction`) or `OPENFACE_DOCKER_IMAGE=algebr/openface` (amd64 image; emulated on Apple silicon, native on Linux x86-64). `GAZE_WARMUP=1` primes it at start-up.
- **Reproduce:** `python -m backend.data.audit_dasd`, `train_gaze_openface_dasd` (v2), `compare_gaze_models`, `train_gaze_v3`, `audit_gaze_leakage`, `benchmark_gaze_runtime`, `validate_webcam_domain`.
- **Model status:** `GET /gaze/status` and `modalities.gaze_detail` on `GET /`. `GAZE_MODEL_VERSION` selects `gaze-openface-dasd-v2` or `-v3` (default).
