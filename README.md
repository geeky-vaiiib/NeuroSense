# NeuroSense

NeuroSense is a **research prototype**, not a diagnostic tool or clinically validated service. A React/Vite frontend collects questionnaires and optional recordings; FastAPI computes the questionnaire score and saves owner-scoped cases in MongoDB.

**Only the server-computed questionnaire score determines the screening result.** Child/adult ML models are supplementary models of legacy score-derived dataset labels. Toddler cohort output is separate from Q-CHAT-10. Gaze is experimental and excluded. Speech provides acoustic measurements; facial analysis provides face detection and image quality. No speech/facial ASD classifier is shipped. Unavailable analyses have null outputs with explicit status; no synthetic inference fallback exists.

Adult technical flows now also report **separate experimental facial-expression and speech-emotion CNN outputs** from versioned, locally trained models. These are not autism predictions or measurements of internal feelings. The new Figshare eye-tracker BiLSTM stays offline because its pixel schema is incompatible with OpenFace webcam angles. [Training results, dataset terms, reproduction and limitations](docs/MULTIMODAL_TRAINING_REPORT.md); [model attribution/licences](backend/models/research/LICENSES.md). RAVDESS-derived artifacts are **noncommercial, share-alike**. ASD speech and diagnostic fusion remain blocked; no clinical validation is claimed.

This questionnaire-only result is an **intermediate implementation**. The supplied presentation targets questionnaire ML, a facial-expression CNN, gaze LSTM, speech model, trained multimodal fusion and explanations of their actual outputs. See the [target architecture and data gaps](docs/TARGET_ARCHITECTURE_AND_GAPS.md), including real partial gaze/AU alignment and missing four-way paired data. The [gaze development protocol and executable harness](docs/GAZE_EXPERIMENT_PROTOCOL.md) advance that target without changing deployed weights or screening eligibility; new raw-data experiments require an auditable reuse permission reference.

| Track | Supported application ages | New screening rule |
|---|---|---|
| Toddler Q-CHAT-10 | 18–24 months | Official five-option scoring; cutoff 3 |
| Child AQ-10 | 4–11 years | Agree on 1,5,7,10; disagree on remaining items; cutoff 6 |
| Adult AQ-10 | 18+ years (technical maximum 120) | Agree on 1,7,8,10; disagree on remaining items; cutoff 6 |

ARC AQ-10 forms specify suspected autism without a learning disability. The application does not assess clinical suitability. Unsupported ages are explained rather than silently assigned another instrument. New child/adult scoring is **version 3**; version-2 cases retain their original cutoff 7 and saved basis. Supplementary ML retains its legacy-label target (7), so it can disagree with the instrument result. No saved case is silently rescored.

See [scoring sources, permissions and evidence](docs/SCORING_AND_EVIDENCE.md). No population autism probabilities, diagnosis, clinical validation, or justified multimodal fusion can be claimed. Research/ethics/instrument-permission requirements remain open.

## Local use

Use Python **3.11.14**, Node **25.9.0**, npm **11.12.1** (the verified runtime; see version files). From the repository root:

```sh
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install --require-hashes -r backend/requirements.lock
npm ci
export NUMBA_CACHE_DIR="${TMPDIR:-/tmp}/neurosense-numba"
NEUROSENSE_PYTHON="$PWD/.venv/bin/python" bash scripts/dev_e2e_backend.sh
```

In another terminal run `npm run dev`; open `http://localhost:5173`, register a disposable account. This backend uses **in-memory storage**, discards data on shutdown, and never connects to a real database. It is intended for local verification only. Use matching frontend/API hostnames so SameSite cookies work. The optional frontend variable `VITE_API_URL` defaults to `http://localhost:8000`; `.env.example` documents it.

For persistence, configure a dedicated research database using `backend/.env.example`, generate your own random `JWT_SECRET`, then run `python -m uvicorn backend.main:app --workers 1 --port 8000`. Do not overwrite an existing `.env` or use production credentials for tests. No built-in accounts exist. More detail: [runtime, deployment and troubleshooting](docs/RUNTIME.md).

## Checks

```sh
NUMBA_CACHE_DIR=/tmp/neurosense-numba PYTHONPATH=backend python -m pytest backend/tests -q
PYTHONPATH=backend python scripts/check_research_consistency.py
PYTHONPATH=backend python scripts/check_gaze_consistency.py
npm test
npm run lint
npm run build
npx playwright install chromium
NEUROSENSE_PYTHON="$PWD/.venv/bin/python" npm run test:e2e
```

Backend tests force fresh in-memory storage and disposable secrets before imports; browser tests launch isolated local services. Recording service failures/dropped responses are controlled fixtures, not real camera/OpenFace coverage. Licensed raw DASD checks may skip when data are absent. [Release acceptance](docs/RELEASE_ACCEPTANCE.md) records actual runs and blockers; [completion plan](docs/COMPLETION_PLAN.md) preserves the initial baseline. `PROJECT_STATUS.md` is a historical review, not current acceptance.

## Authentication and data ownership

Argon2 passwords; signed/expiring JWT in HttpOnly cookie; database-resolved active user and role; server-side JTI revocation. Cookie writes require `X-Requested-With: NeuroSense`; explicit CORS origins only. Expired sessions redirect to sign-in. Failed logout is shown as unconfirmed and can be retried. Account registration cannot assign a clinician role. Cases, explanations, and gaze jobs are scoped to the authenticated user; other owners receive 404. Legacy cases without an owner remain invisible until deliberately assigned by an operator.

The `backend/scripts/manage_users.py` operator commands support role assignment and deliberate legacy ownership migration; inspect their dry-run options before use. No role or record migrations were run in this review. Notes in the Results page remain **browser-local**, not a shared clinician record.

Identical screening retries carry `Idempotency-Key`; a MongoDB owner/key unique index atomically stores one case and its exact response. Reuse with different request data returns 409. Unsaved drafts/keys stay in the mounted browser flow and do not survive navigation. See runtime limitations before designing data collection.

## Optional analyses and operations

Gaze: browser video → durable job/lease → FFmpeg normalization → OpenFace → quality/domain gates → experimental BiLSTM. A technical domain pass never enables gaze in the screening result. Any worker can poll shared MongoDB jobs without failing them on a local cache miss. Lease/deadline expiration produces explicit unavailable status; timeouts **do not cancel computation**. Uploads/intermediate files are deleted after processing; the private spool sweeps stale crash leftovers at startup.

Use **one application worker/instance**: authentication throttles, per-user admission serialization, and OpenFace resource semaphores remain process-local. In-memory database mode is inherently process-local. Multi-worker polling safety does not establish distributed scheduling or rate limits.

Optional OpenFace needs a trusted native FeatureExtraction 2.x binary or amd64 Docker image; FFmpeg/ffprobe are needed for browser recordings. Linux x86-64 is the recommended OpenFace host; Apple silicon Docker emulation processed synthetic blank WebM/MP4 fixtures; real webcam capture remains unverified. See [gaze execution evidence](docs/GAZE_EXECUTION_REPORT.md). The backend Dockerfile does not include OpenFace or a Docker socket. Camera/microphone require HTTPS or localhost.

`/live` is process liveness; `/ready` reflects core database availability with 503 when unavailable; `/` reports optional capabilities. Optional model failures do not block deterministic scoring; mandatory security/DB configuration failures still fail startup. Artifact runtime pins match sklearn 1.6.1 and XGBoost 2.1.4; model files are unchanged. CI and deployment **configuration** are supplied, not deployed or independently certified for production.

## Research reproducibility

The toddler audit script rechecks checksums, participant-ID splits, stored scores, checkpoint predictions, AUC/Brier and participant bootstrap intervals without retraining. Reported nested training/gaze evaluations are distinguished from independently reproduced consistency checks in the evidence audit. Source confounding, prior holdout reuse, population mismatch, participant permissions, ethics and instrument electronic-administration rights remain limitations. Dataset attribution is in `backend/data/DATASET_ATTRIBUTION.md`; future modality-data requirements are in `backend/data/TODDLER_MODALITY_DATA_REQUIREMENTS.md`.

No training command is part of setup or CI. Training scripts and quarantined synthetic-proxy artifacts are preserved for provenance; they must not be represented as validated runtime classifiers.

### Academic demo

Use the [demo runbook](docs/DEMO_RUNBOOK.md) for locked setup, disposable accounts/storage, actual execution preflight and the five-minute sequence. With the locked `.venv-demo` and an installed working OpenFace image:

```bash
OPENFACE_DOCKER_IMAGE=algebr/openface .venv-demo/bin/python scripts/demo.py
```

Open `http://127.0.0.1:5173`. New submissions use a saved backend-owned `research-report-v1` for UI/PDF agreement. The explicit **Recorded example** page shows genuine, independently sourced model outputs with provenance; it never substitutes for a live result. Eye-tracker `gaze-v1` has a separate schema-checked offline research CLI. Physical webcam validation remains an operator check; see the runbook's verified scope.
