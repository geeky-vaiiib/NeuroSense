# NeuroSense completion plan

Baseline inspected 2026-11-02, commit `9cfb9b35de2e6f3ad59909562eddeeed2624afad`; work branch `codex/research-prototype-completion`. No applicable AGENTS.md found in repository or ancestor directories. Prior PROJECT_STATUS.md is historical evidence, not verification of this revision.

## Verified baseline

Environment: macOS arm64, Python 3.9.6, Node 25.9.0, npm 11.12.1. Test commands explicitly set `MONGODB_URI=mongomock://baseline`, a disposable JWT secret, and `GAZE_WARMUP=0`. No real database connection or production-data mutation was performed.

| Command | Baseline result |
|---|---|
| `PYTHONPATH=backend python3 -m pytest backend/tests -q` (isolated env above) | 237 passed, 3 failed in 24.44 s; all failures speech decoding/measurement. Version warnings for sklearn 1.6.1 artifacts in 1.5.2 runtime, XGBoost serialization, host LibreSSL. |
| `npm test` | 65 passed, 6 files |
| `npm run lint` | pass |
| `npm run build` | pass; >500 kB chunk warning |

## Code traced

* Authentication: AuthContext → api credentials/custom CSRF header → routers/auth → Argon2/JWT → HttpOnly cookie; `/auth/me` restores; authenticated dependency checks expiration, revocation, DB active flag and role. Logout revokes JTI. ProtectedRoute waits for restoration. Login/registration throttles are process local. Logout currently hides network failure.
* Child/adult: ScreeningStart → Screening/QuestionFlow → useScreening → screeningApi → ScreeningRequest → questionnaire_score → optional model → measurement/status contract → combine → owner-bound cases collection. Adult backend exists but frontend CATEGORY_ORDER/content/age validator currently only implement child: adult is inaccessible/misrouted.
* Toddler: ToddlerScreening/ToddlerQuestionFlow → five-option generated config → qchat10/toddler_service → official score + independent cohort-model block. All modalities skipped. Historical cases retain stored basis.
* Recording: GazeSession/SpeechSession/FacialSession capture browser media; gaze uploads temporary video → thread jobs → normalization/OpenFace → gates/model; speech base64 → decoder/acoustic measurements; facial image → detection/quality. Skip/failure status is separate from questionnaire result. No speech/facial ASD classifier shipped for runtime.
* Persistence/results: cases_store normalizes stored data, queries by owner; cases/history/dashboard → Results by saved id, stored questionnaire basis → ExplanationPanel and generatePDF. Explanations use stored score and supplementary model; toddler PDF disabled at baseline. Notes are browser local. Legacy records are not rescored.
* Training/reports: questionnaire train_model and label audit; toddler qchat_polish/train_toddler_qchat + checkpoint metadata/predictions; gaze participant-split trainers/comparisons/leakage/domain reports. Reports are claims until checked. No retraining authorized here.
* Runtime: main lifespan validates security configuration, loads optional models, initializes database; `/` reports capabilities. requirements pins disagree with artifacts; npm lock present. No CI/container at baseline. OpenFace/FFmpeg external; authentication and resource caps constrain multiple workers.

## Confirmed defects and priorities

| Priority / phase | Problem | Acceptance criteria |
|---|---|---|
| P0 reliability | Polling another worker marks live gaze processing interrupted; best-effort persistence and unconditional replacement can overwrite terminal outcomes | Shared authoritative jobs, durable owner lease/heartbeat, atomic terminal transitions; owner-only polling; late completion cannot revive timeout; fake processing tests and cleanup on rejection/failure/success. Document process-local caps and timeout != cancellation. |
| P0 reliability | Corrupt optional pickle/background aborts startup; obsolete mock-mode message | Optional load failures produce unavailable bundle/log; deterministic score starts; mandatory security/DB errors still fail. Missing/corrupt/incompatible regression tests. |
| P0 scoring | Child/adult cutoff 7 is a dataset-label rule, not instrument cutoff | Verify primary sources; version any correction; retain historical basis. Frontend wording/direction checked; threshold boundaries and historical retrieval tested. |
| P1 flows | Adult frontend absent; toddler PDF absent; ambiguous retries create new IDs; logout network failure hidden | Complete existing three tracks, server-enforced owner/request-bound idempotency; retry preservation; truthful logout and unavailable states; component/API/browser tests and PDF consistency. |
| P1 reproducibility | Artifact dependency mismatch, unconstrained packages, missing CI | Evidence-based compatible runtime or explicitly unavailable models; exact constraints/lock, clean install check, isolated CI; no warning suppression or retraining. |
| P1 acceptance | Prior browser/hardware verification not independently reproduced | Current commands and actual browser results logged; mocked and hardware tests separated; no readiness claim beyond evidence. |
| P2 operations | In-process auth throttle/OpenFace slots; abrupt shutdown may leave raw files | Single-worker deployment default; document cleanup/recovery, resource limits, HTTPS/CORS/cookies, readiness separate from optional capabilities. |

## Implemented, incomplete, unsupported

Implemented: deterministic scoring, owner-scoped cases/history/dashboard, JWT sessions, supplementary child/adult ML, toddler cohort output, experimental gaze, acoustic and detection/quality measurements, stored score explanations, child PDF. Technically tested at baseline except the three failing speech checks above. Incomplete: adult UI, toddler PDF, robust shared gaze lifecycle, reproducible runtime/CI, automated browser flows and accessibility/hardware acceptance. Unsupported: diagnosis, population autism probabilities, clinical validation, classifier-based speech/facial results, any multimodal fusion result.

## Research and permission dependencies

ARC instrument wording/usage permissions, including authored helpers/adaptations; primary instrument sources must be checked. Independent clinically assessed participant labels and representative external cohorts, ethics/guardian consent, retention/deletion and governance policies cannot be supplied by code. Toddler source confounding and previously inspected holdout limit claims. Gaze recording-context confounds and lack of untouched external test remain. Speech/facial need licensed participant-labelled corpora before classifiers can be considered. No model training or production deployment in these phases.

## Definition of done

All changed behavior covered by meaningful regression tests; isolated backend and frontend tests/lint/build pass in documented clean runtime; three questionnaire browser flows and failure recovery run; stored/UI/PDF provenance agree and historical basis preserved; optional failures never fabricate success; authenticated ownership/CSRF/role checks pass; jobs have durable race-safe lifecycle and documented cleanup constraints; setup/CI/deployment configuration reproducible; evidence audit separates inspected facts, reported metrics and independently reproduced checks; remaining external/hardware blockers explicitly gate the release verdict. No clinical or production-readiness claim follows from engineering completion.

## Phase record

Baseline phase changes: this plan only. Verification above. Next: backend reliability, then scoring/evidence, flows, runtime, final acceptance. Later phase outcomes are recorded in SCORING_AND_EVIDENCE.md, RUNTIME.md and RELEASE_ACCEPTANCE.md; incomplete criteria stay open there.

## Implementation phase closeouts (2026-11-02–03)

| Phase | Changed file groups | Actual verification | Limitations / next phase |
|---|---|---|---|
| Backend reliability | `ml/gaze/jobs.py`, `core/recordings.py`, gaze router/main, model loader, isolated test fixtures and lifecycle tests | Initial targeted suite 30 passed; final full backend suite includes lease/owner/terminal/cleanup/artifact tests | MongoDB CAS is shared; resource/admission/auth throttles remain process-local. Next: instrument/evidence audit. |
| Scoring/evidence | questionnaire scoring v3, backend-owned AQ content + exporter, provenance tests; SCORING_AND_EVIDENCE and evidence JSON | Every score 0–10 covered; historical basis retrieval/explanation; 63 toddler predictions and saved metrics independently checked; gaze split/metric arithmetic checked | Rights/ethics, source confounding and external validity unresolved. No retraining. Next: user-flow completion. |
| User flows | adult routing/content, retry hook/API, atomic submissions/index, recording navigation, logout semantics, result copy, PDF exporter, component/browser tests | Frontend component suite 72 passed; browser suite covers real local auth/scoring/saved results with explicit failure fixtures; PDF fixtures rendered | Real camera/mic/OpenFace smoke and screen-reader audit remain unexecuted. Explanation model is current model, not historical snapshot. Next: reproducible runtime. |
| Runtime | exact direct pins + universal hash lock, version files/env examples, README/RUNTIME, CI, Dockerfile/nginx example | Fresh Python 3.11 install + final hash sync; artifact predictions unchanged for 22 fixtures with no compatibility warnings; fresh npm install/tests/lint/build; Dockerfile check | Full Linux image build/CI execution and operational load validation not reproduced locally. Six moderate toolchain advisories remain. Next: final acceptance. |
| Acceptance | RELEASE_ACCEPTANCE, source-copy corrections, non-breaking advisory remediation, model explanation correctness/responsiveness regressions | Exact final command counts/commit/environment and criteria are in RELEASE_ACCEPTANCE | Verdict remains bounded by documented evidence; next phase is approved human-participant/hardware and Linux deployment validation, not clinical release. |

The baseline-only instruction was honored by writing this plan before reliability fixes. Subsequent implementation follows the additional phases explicitly requested in the same task. Nothing has been merged or deployed, no real database used, and no models retrained or replaced.

## Academic demo integration (2026-11-06)

Implemented: backend-owned saved report v1 and shared UI/PDF text, explicit eight-card modality inventory, independent saved research example, eye-tracker schema-checked offline inference, disposable launcher/execution preflight, same-tab owner-scoped expiry recovery and accepted-job resume. Questionnaire scoring, ownership, historical records and experimental exclusions remain. See DEMO_RUNBOOK.md and docs/evidence/demo_execution.json for acceptance scope. Remaining: adult-operator physical webcam/microphone tests and usable-face webcam inference, authorized ASD speech data, paired multimodal data, external/clinical validation. No new model training or diagnostic fusion occurred.
