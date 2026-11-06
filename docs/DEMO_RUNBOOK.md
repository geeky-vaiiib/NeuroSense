# Academic demonstration runbook

Scope: a questionnaire-led research demonstration with separate experimental outputs. Not diagnosis, clinical validation, calibrated population risk or trained diagnostic fusion. New work started from main `374f5807b9e938f35da852a2608e62255ec4cc32`; the commit containing this runbook is the demo implementation. See `git rev-parse HEAD` for the exact checkout. No checkpoints were retrained or replaced.

## Setup and start

From the repository root, use Python **3.11.14**, Node **25.9.0** (the CI version; package engine requires >=22.12), and the committed locks:

```bash
python3.11 -m venv .venv-demo
.venv-demo/bin/python -m pip install --require-hashes -r backend/requirements.lock
npm ci
```

Install FFmpeg and FFprobe on PATH. For webcam gaze, configure an existing real OpenFace 2.x `FeatureExtraction` binary with `OPENFACE_BIN`, or run the locally tested Linux/amd64 `algebr/openface` Docker image. This requires a working Docker daemon and appropriate local permissions; no automatic image pull or infrastructure provisioning is part of setup. A native Linux x86-64 host avoids Apple-silicon emulation. See `RUNTIME.md` and `GAZE_EXECUTION_REPORT.md` for execution limits and known image provenance. Do not expose the Docker socket publicly.

For an already installed Docker image, the exact full-demo command is:

```bash
OPENFACE_DOCKER_IMAGE=algebr/openface .venv-demo/bin/python scripts/demo.py
```

For native OpenFace:

```bash
OPENFACE_BIN=/absolute/path/to/FeatureExtraction .venv-demo/bin/python scripts/demo.py
```

Open **http://127.0.0.1:5173**. API: **http://127.0.0.1:8000**. Do not mix `localhost` and `127.0.0.1`. Register your own disposable account using the normal registration flow. There is no fixed password, token, role override or authentication bypass. The launcher overrides database/security settings before dotenv loads: `mongomock://academic-demo`, one process, randomly generated secret, exact localhost CORS, non-secure localhost cookie, private temporary recording spool. It does not read or connect to a production database. Accounts/cases disappear when the process stops. Ctrl-C stops both services and removes its temporary directory. Do not use this in-memory setup with multiple workers.

Preflight only:

```bash
OPENFACE_DOCKER_IMAGE=algebr/openface .venv-demo/bin/python scripts/demo.py --preflight-only
```

Expected: PASS for locked Python and applicable dependency versions; hashes in `backend/models/demo_manifest.json`; questionnaire/cohort model inference; CNN numeric inference; separately typed eye-tracker inference; webcam checkpoint numeric forward pass; FFmpeg/FFprobe; actual OpenFace extraction on a generated two-second blank clip. Blank-clip execution **does not** establish face tracking, quality/domain acceptance or webcam inference. The launcher subsequently checks backend readiness and frontend HTTP connectivity and refuses occupied ports. Missing/corrupt models, wrong lock versions, missing FFmpeg/FFprobe or failed required OpenFace execution exit nonzero with actionable text. OS sandbox access to Docker can block preflight despite an installed image.

Explicit reduced profile, when OpenFace is unavailable:

```bash
.venv-demo/bin/python scripts/demo.py --without-webcam
```

This prints **NOT RUN** for OpenFace execution. Skip live gaze, then explicitly open the recorded example. It never silently replaces a live recording. If `OPENFACE_*` is configured but unusable, the health presence check can still say installed; the full execution preflight is the authoritative executable check. Unset that setting for a genuinely unavailable service, or skip it explicitly.

## Five-minute sequence

1. **0:00–0:45:** Show preflight output, register/login, select Adult (18+). Explain that questionnaire scoring alone determines screening and every other task is separate.
2. **0:45–1:45:** Complete consent/demographics and the ten questions; edit an answer in review if needed. Child AQ-10 is 4–11; Q-CHAT-10 is 18–24 months. Ages 25 months–3 years and 12–17 years are unsupported. The existing canonical adult UI limit is 120 and the API now agrees; that software bound does not establish model coverage at older ages.
3. **1:45–3:00:** Adult operator explicitly starts camera/microphone. Gaze: setup, countdown, normal 30-second task, real job stages. Speech: 20-second audible sample; facial: detected still image. Use Retry or Skip as appropriate. Do not coach movement toward a desired output. A valid domain rejection is an honest result. Gaze processing can exceed the five-minute talk slot—use the explicitly labelled example if necessary.
4. **3:00–4:00:** Review then submit. Read the unified saved report: questionnaire score/threshold, supplementary model, webcam gaze, separate eye-tracker state, acoustic measurements/ASD speech unavailability, facial quality, expression CNN and speech-emotion CNN. Open history and reload the case. Model classes, units, reasons and values come from the saved backend report.
5. **4:00–5:00:** Download PDF. Open **Recorded example** in the sidebar and click **Load recorded example** to show genuine independent saved expression, emotion and eye-tracker outputs with their model versions/hashes. State clearly that these are different dataset participants, not a fused individual. Export the labelled example PDF if live hardware is unavailable.

## Model/input inventory

| Model | Supported input and actual execution | Meaning and constraints |
|---|---|---|
| Deterministic AQ-10 child/adult | Ten canonical answers, server reverse coding; 4–11/18+; score threshold 6, scoring v3 | Screening instrument score, not diagnosis. Old saved versions retained. |
| Child/adult supplementary ML | `backend/ml/model_{child,adult}.pkl` with matching encoders; synthetic valid questionnaire fixtures exercise actual prediction | Score-derived training labels (historical cutoff 7), not independent ASD validation; displayed separately. Feature ordering lives in `preprocessor.py`/`config.py`. |
| Toddler Q-CHAT-10 + Polish cohort model | Ten five-option answers, 18–24 months; official threshold 3; `models/toddler_qchat10_polish_v1` | Cohort similarity remains separate from the official score. Existing cohort calibration is not population autism probability. |
| Facial expression CNN `facial-v1` | Detected/cropped/CLAHE grayscale 64x64 still; shared detector and preprocessing; adult technical flow | Seven posed-expression classes, not ASD or internal feelings. Source age metadata insufficient; camera/age/device transfer unvalidated. |
| Speech emotion CNN `speech-v1` | Mono 16kHz, trimmed 64-bin log-Mel 4-second chunks; live flow also requires >=5-second valid acoustic sample | Eight acted-English emotion classes; adult technical only, uncalibrated. RAVDESS-derived noncommercial/share-alike terms apply. |
| Webcam `gaze-openface-dasd-v3` | FFprobe media timing -> OpenFace angles -> tracking quality -> frozen preprocessing/domain gates -> BiLSTM | Experimental historical child-cohort output. Not eye contact, calibrated screen position or fixation. Checkpoint and numeric pipeline tested; real usable-face webcam inference remains operator-dependent/unverified. No new DASD evaluation/training. |
| Eye-tracker `gaze-v1` | Separate offline research CLI: centered screen-pixel windows, 20Hz, 80x2, frozen train normalization | Cilia source cohort only, not webcam angles. Label order TD/ASD is from source metadata; diagnostic ascertainment unverified. Temporal shuffle control performed similarly. Never a screening input. |
| ASD speech | No suitable installed classifier | Unavailable/null. Emotion never substitutes for ASD classification. |

The manifest pins active weights, metadata, encoders and explanation backgrounds. Historical baseline gaze v2 and superseded legacy toddler artifacts remain preserved; they are not silently selected for the live demo. Archived/quarantined artifacts are not usable candidates. Existing gaze tests load v2/v3; the launcher tests the deployed v3.

## Separate eye-tracker research workflow

No retraining, participant-data download or webcam conversion occurs:

```bash
OMP_NUM_THREADS=2 .venv-demo/bin/python -m backend.ml.eye_tracker_research /private/path/input.json /private/path/output.json
```

Input JSON fields: `schema: "eye-tracker-screen-pixels20hz-4s-centered-v1"`, `provenance: "permitted_research_recording"` (or explicitly `"synthetic_numeric_engineering_fixture"`), and `windows`, 1–30 arrays of 80 pairs `[centered_x_px, centered_y_px]`. Use the existing versioned trainer's Cilia preprocessing: participant/trial separation, eye averaging, valid-coordinate filtering, time ordering/deduplication, 20Hz interpolation, <=0.25s interpolation gaps, <=20% holes, four-second windows/two-second stride, per-window centering, up to 30 evenly selected windows per participant. Normalization is applied by inference from training metadata; do not normalize twice. Reject incompatible schemas/nonfinite/wrong-shape/noncentered inputs. A schema declaration cannot prove a new dataset matches the source protocol; operators must verify that independently. Results are JSON, offline, never attached to a screening as webcam data. Keep input/output in private ignored storage.

## Recorded example provenance

`backend/reports/research/recorded_demo_example.json` contains genuine frozen inference from the first **training/development**, cached schema input for each of V_Expression, RAVDESS and Cilia (different participants), plus synthetic questionnaire answers. It contains no raw media, participant identifiers or private manifests. It is a presentation example, **not** held-out evaluation or a live capture pass. Sources/licences and hashes are in `MULTIMODAL_TRAINING_REPORT.md` and the model licence notice. The speech example uses a source chunk and does not claim the live five-second acoustic gate passed. The face uses cached detector preprocessing; original face extraction was audited during training.

`PYTHONPATH=. .venv-demo/bin/python scripts/build_recorded_example.py` can create the file in a fresh checkout/export **only if** the documented permitted caches already exist. It never downloads data and refuses to overwrite an existing example. Do not regenerate examples until a model gives a desired class. The authenticated read-only endpoint `/research/recorded-example` never creates a patient case and is never called automatically on inference failure.

## Report contract and recovery

New cases persist `research-report-v1` at submission with case ID, UTC generation time, instrument/scoring provenance, typed modality cards, raw values, units and backend-rendered text. API, storage, reopening, UI and PDF share that saved object. Presentation: numeric values three decimals, class scores one-decimal percent; those percentages are uncalibrated scores, not diagnostic probabilities. New questionnaire/cohort/gaze model outputs, CNN scores and acoustic/image measurements retain computed precision; only presentation text is rounded. Toddler/gaze supplementary classification now compares the unrounded output with its existing frozen threshold, avoiding a rounding-induced boundary flip. Weights/preprocessing are unchanged; historical outputs are not rescored. Historical stored precision is not recoverable and is not fabricated. Speech rate is a proxy, not measured syllables/second. The backend summary is deterministic and does not average tasks or calculate a diagnostic aggregate. Measurements may be available while an ASD classifier remains unavailable. Failed/skipped model output remains null.

No report is generated retroactively for historical cases: their original fields/rendering remain available, without rescoring. Optional on-demand SHAP/LIME still explain a questionnaire model separately; they are not frozen into `report-v1` or a claimed explanation of diagnosis. The immutable report's questionnaire item points explain the screening score.

On network timeout, Retry retains the identical idempotency key and the server returns the same saved report. After session expiry, sign in as the same owner to return to the interrupted route. Answers, consent state, completed recordings and accepted job IDs survive **only in this tab's memory**; no raw recordings, answers or tokens are written to browser storage. Drafts are scoped to the server user ID, cleared after success/confirmed logout and lost on reload/tab close. Accepted gaze jobs can resume polling after remount without another upload; expiration still produces an explicit server outcome. Stop waiting does not cancel server computation. If unsaved state is lost, check history before starting a new submission. Persistent drafts across reload are deliberately not claimed.

Camera/microphone are requested only after user interaction and a successful backend capability check. Missing optional expression/emotion model permits acoustic/quality measurements with an explicit notice. Live media support: browser MediaRecorder-selected WebM VP8/VP9 or MP4 for gaze; WebM/Opus, MP4 or browser-supported audio for speech, decoded by FFmpeg; JPEG/PNG still for face. Browser `isTypeSupported` and actual hardware permissions decide availability. The preflight exercises WebM decode, not every browser codec/device combination. Interrupted recording cleanup and accepted-job tests use controlled boundaries; see `HARDWARE_SMOKE_TEST.md` for the separate physical test.

Practical failure recovery: align hostnames; sign in again if expired; free ports 8000/5173; install locked dependencies; restart after changing optional artifacts; fix Docker permission/native OpenFace executable problems; explicitly skip or open the recorded example if hardware is unavailable. Do not weaken quality/domain gates. Do not upload raw recordings to Git, public issues or CI artifacts.

## Verification scope

The accompanying execution evidence records actual commands and counts. Backend tests use an isolated source export without DASD/raw media/.env and per-test mongomock/storage; E2E uses disposable accounts and a real backend. Browser microphone-denial and interrupted-camera tests mock media boundaries. The six-second generated tone exercises actual speech CNN/application persistence but is not human speech or emotion validation. The recorded example exercises actual frozen networks on permitted cached development inputs. Real face API smoke uses a permitted source image; short source audio is correctly withheld by the unchanged five-second live gate. No physical camera/microphone interaction has been performed by the agent.

Live usable-face webcam tracking/quality/domain/inference, physical unplug/hide-tab behavior, and practical device performance require the adult operator checklist. These remain NOT RUN, even when OpenFace preflight passes. No scientific evaluation metrics are newly claimed in this integration phase. Do not call the entire project complete or clinically validated.

Final local acceptance: **343 backend passed / 7 skipped / 0 failed**, **102 frontend passed**, lint/build passed, **7 Chromium E2E passed** (21.2s, supported reduced-motion setting), both saved-research consistency checks passed. The original-motion runs had intermittent actionability/session-restoration stalls on this host; reduced-motion acceptance is explicitly scoped and does not validate physical-device animations. Full locked preflight and final launcher connectivity passed. All five saved-example PDF pages were rendered/visually inspected. Detailed command/outcome history: `docs/evidence/demo_execution.json`; permitted-media parity/cleanup: `docs/evidence/demo_permitted_fixture.json`. CI must be checked on the actual pushed commit, independently of these local results.

Clean setup verification: a new ignored `.venv-demo` was populated with all 86 applicable hash-locked packages. Testing the exact direct-script command with `PYTHONPATH` removed exposed and fixed a launcher import-path defect; a subprocess regression now checks that invocation from an arbitrary working directory. The launcher explicitly adds its repository root for imports and still overrides child-process database/security configuration. The prepared environment is local only and is excluded from Git.

The clean demo environment, no-PYTHONPATH direct launcher, actual OpenFace execution, both HTTP endpoints and graceful shutdown passed. The isolated full suite in that fresh environment passed 343 tests with 7 optional-data skips. Local subprocess OpenMP verification required execution access outside the tool sandbox; no assertion or dependency check was suppressed.

## Plain-language results and export choices

Results now open with **Your screening summary**: saved score/threshold, what it means, a next step and three optional recording summaries. **View answer breakdown** and **Technical details** are native keyboard-accessible disclosures, collapsed initially. Technical details retain model outputs, class scores, quality, model versions and provenance. **Load model explanations** is optional; no explanation request delays the default result.

**Download report** produces the simple report. **Detailed technical report** includes the same summary followed by scoring/model evidence and any actual loaded explanations. Both use the same backend presentation, never a new calculation. Recorded examples remain labelled as examples on screen and throughout PDF footers. Existing records are adapted for display without rescoring or overwriting their stored report. See RESULTS_CONTRACT_AUDIT.md for field provenance and compatibility details.

Browser QA can run on separate disposable ports while preserving an already running demo:
`NS_E2E_API=http://127.0.0.1:8002 NS_E2E_WEB=http://127.0.0.1:5180 NEUROSENSE_PYTHON=.venv-demo/bin/python npm run test:e2e`.
Use an absolute Python path if running outside the repository root. Physical recording checks remain separate. A running backend must load this revision before it can return the new presentation fields; hot-reloading frontend code alone does not update a running Python process.
