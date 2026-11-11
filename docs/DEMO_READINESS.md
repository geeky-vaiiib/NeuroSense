# Academic-demo readiness — 2026-11-11

Reviewed baseline: `950aa6571cb098dec5a2b254cf069d022c1c8352`, main, clean before this phase. Its own GitHub Actions run [42257837483](https://github.com/geeky-vaiiib/NeuroSense/actions/runs/42257837483) completed successfully. This phase adds the isolated acceptance runner and its regression tests; it does not change application predictions, weights, gates, stored reports or scoring. The containing commit's CI must independently pass.

## Current verdict

**Prepared and verified for the automated/fixture academic demonstration. Physical full-session acceptance remains pending.** “Completely ready” for all live cameras/microphones or clinically validated is not supported by current evidence. No physical test observations were supplied during this continuation. No camera was activated by the agent.

| Capability | Actual verification | Limit |
|---|---|---|
| Questionnaire scoring and supplementary models | Locked preflight, full backend tests, child/adult/toddler browser flows | Questionnaire alone determines screening; supplementary models are not independent clinical validation |
| Speech acoustics + emotion CNN | Permitted training-source audio through actual inference, authenticated API, storage and reopening | Separate emotion task; engineering quality checks are not a general speech detector; physical mic session pending |
| Face measurements + expression CNN | Permitted training-source image through actual detection/preprocessing/inference, API, storage and reopening | Separate expression task; heuristic input checks and device transfer unvalidated; physical capture pending |
| Webcam OpenFace + frozen BiLSTM | Artifact hashes/numeric model pass, synthetic gate/lifecycle tests, actual OpenFace blank-video execution | Blank clip is NOT usable-face evidence; physical capture/tracking/quality/domain/inference A–E remain NOT RUN |
| Eye-tracker gaze-v1 | Separate schema and actual numeric inference in preflight | Screen pixels, never webcam angles; no diagnostic fusion |
| Results/history/PDF | Existing browser flows and contract tests passed; both PDF modes visually inspected in preceding integration phase | This continuation changes no rendering; physical-session report consistency still pending |

## Confirmed local environment blockers resolved

1. `.venv-demo/bin/python3.11` pointed at a removed `/tmp` Python installation. Repaired its interpreter reference to the persistent installed Python 3.11.14 and upgraded venv metadata without clearing installed packages. All applicable dependency versions and shipped artifact hashes passed preflight afterward. Keep interpreter installations outside temporary storage.
2. Docker Desktop was stopped, so OpenFace execution failed even though configuration/image existed. Started the installed local daemon (29.4.1); repeated full preflight successfully. No images downloaded, external infrastructure created or deployment performed.

Environment: Python 3.11.14, Node 25.9.0, FFmpeg/FFprobe 9.0.2, macOS arm64. Existing operator server/accounts on ports 5183/8005 were preserved. A fresh documented demo was started separately on ports 5173/8000 with disposable mongomock storage, random session secret and matching 127.0.0.1 hostnames.

## Commands and actual results

```bash
.venv-demo/bin/python scripts/check_backend_isolated.py
npm test
npm run lint
npm run build
NS_E2E_API=http://127.0.0.1:8004 NS_E2E_WEB=http://127.0.0.1:5182 \
  NEUROSENSE_PYTHON="$PWD/.venv-demo/bin/python" npm run test:e2e
OPENFACE_DOCKER_IMAGE=algebr/openface .venv-demo/bin/python scripts/demo.py --preflight-only
OMP_NUM_THREADS=2 .venv-demo/bin/python scripts/verify_recording_fixtures.py /tmp/ns-ready-permitted-reports.json
```

- Backend: **370 passed, 7 skipped**, 934 upstream warnings, 25.71 seconds. Both saved-research consistency checks passed with optional DASD absent.
- Frontend: **113 passed**; lint **PASS**; build **PASS**, existing large-bundle advisory remains.
- Browser E2E: **7 passed**, 29.8 seconds. Camera boundary controls/generated-tone inference are explicitly engineering fixtures, not physical recording validation.
- Permitted-media script: **PASS speech and facial** actual model inference/API/saved/reopened equality, separate source people and separate cases. No data downloaded or new model training/evaluation performed.
- Full preflight: **PASS**, including 30 rows from a generated blank clip through real OpenFace. No usable-face claim.
- Local launcher: frontend/backend readiness **PASS**; no production database connection or auth bypass.

The new backend runner exports current tracked working-tree files into a private temporary directory, rejects symlinks/external paths, excludes raw datasets/environment files, overrides database/import paths, and asserts the imported DASD module belongs to that export with no raw corpus before test collection. It then runs the full suite and consistency scripts from the export itself. Stage intended newly added tests/scripts before using it; untracked/ignored files are deliberately not copied. Two regressions cover exclusion of secrets/raw data, retention of working edits, external-link refusal and environment overrides. Do not substitute a test-directory path while leaving cwd at the dataset-bearing checkout.

## Start / operator acceptance

```bash
OPENFACE_DOCKER_IMAGE=algebr/openface .venv-demo/bin/python scripts/demo.py
```

Start Docker first. Open **http://127.0.0.1:5173**; register a disposable account normally. If already running, use the existing instance; do not launch another copy on occupied ports or terminate accounts without considering data loss. All demo data disappears when its process exits.

The next indispensable action is one adult-operated physical session: questionnaire, normal 30-second gaze task, audible voice recording and one usable facial capture, then saved report/reopening/both PDFs. Keep the tab visible and follow normal setup; do not adjust movement to force a desired model output. Record capture acceptance, OpenFace features, quality, domain decision and model result separately. A domain rejection is acceptable when accurately reported with retained measurements and null classification. Provide only the case reference and observed statuses, not recordings, identifying screenshots or credentials.

Remaining research dependencies are unchanged: unverified DASD reuse terms for new research, age/task/device/language transfer, independently labelled ASD speech, paired participant-level multimodal data for any future fusion, and appropriate independent validation. No software acceptance test resolves those dependencies.
