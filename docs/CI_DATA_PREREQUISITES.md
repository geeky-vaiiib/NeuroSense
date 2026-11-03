# CI optional-data prerequisite correction — 2026-11-03

Baseline: `be5fa03a2dd590f32d6614f0955f3451755ff27f`, `main`, origin `https://github.com/geeky-vaiiib/NeuroSense.git`. No applicable AGENTS.md was found. Working tree was clean before this phase. Fetched/pulled main with fast-forward only. No branch, model, participant data, scoring rule or domain threshold was changed.

## Reproduced failure and acceptance criteria

[Failed Actions run 41571090451](https://github.com/geeky-vaiiib/NeuroSense/actions/runs/41571090451) reports **292 passed, 6 skipped, 1 failed**. Its backend failure prevented all subsequent frontend checks from running. `test_domain_gate_flags_stillness_and_passes_dasd_children` checked only the shipped checkpoint before calling `next()` on external DASD recordings. In a normal Git checkout those recordings are absent, so it raised `StopIteration`.

Reproduced the same failure in `/tmp/neurosense-ci-no-dasd`, populated with `git archive HEAD | tar -x`, before copying the patch. This excludes ignored DASD data and local environment files without moving/deleting existing data. The single test failed with `StopIteration` in 1.11 seconds.

Acceptance: absent licensed data skips clearly; a present but incomplete/malformed corpus fails meaningfully; synthetic numeric coverage still tests domain acceptance, rejection and null withheld output; no participant download, gate weakening, model replacement, removed assertions or continue-on-error.

## Implemented correction and audit

* Added the existing `needs_dasd` prerequisite to the failing test. All seven dataset-dependent tests now share a module fixture that validates the installed corpus before use. The optional-data helper checks directory structure, documented label counts, duplicate participant IDs (via discovery), CSV columns/numeric parsing and timestamp presence. Absence alone returns unavailable; invalid installed data raises an error.
* Added eight engineering regression cases: absent/missing/incomplete/malformed data, deterministic numeric in-range/above-range/below-range domain math, and frozen-service inference plus null withholding. The numeric inputs are synthetic software fixtures, **not evidence about actual participants, webcam performance or scientific validity**.
* Audited tests and scripts invoked by `.github/workflows/research-checks.yml`. Raw DASD access is confined to the marked gaze tests. Training-module imports in donor-swap tests use numeric fixtures rather than reading external recordings. Questionnaire label-rule tests read tracked adult/child/legacy-toddler CSVs and already have explicit missing-data skips. The toddler consistency script uses the SAV file and saved predictions already tracked in Git; clean export verified these are present. Browser tests use disposable storage and controlled media boundaries.
* Also corrected the gaze consistency script's ineffective `FileNotFoundError` handling: discovery returns an empty list for absent data. It now explicitly reports raw-data checks unavailable, rather than reporting zero participants/zero overlap as if verified. Added this lightweight audit to CI. No training is invoked.

## Local verification

Environment: macOS arm64, Python 3.11.14, sklearn 1.6.1, XGBoost 2.1.4, torch 2.6.0, Node 25.9.0, npm 11.12.1. The isolated `/tmp/neurosense-clean` venv matches all 86 locked packages (`uv pip sync --dry-run --offline --require-hashes backend/requirements.lock`: would make no changes); `uv pip check`: compatible. Pip is not installed inside this uv-created venv. Sandbox initially blocked uv's macOS configuration access; the authorized offline dry run succeeded outside that sandbox.

Commands below use the isolated venv's Python; backend/consistency checks ran in the clean export after copying only the intended patch, with no DASD directory or real database. Full-suite storage is replaced by per-test mongomock/spools in conftest.

| Command | Actual result |
|---|---|
| `MONGODB_URI=mongomock://ci GAZE_WARMUP=0 NUMBA_CACHE_DIR=/tmp/neurosense-numba-ci PYTHONPATH=backend python -m pytest backend/tests -q -rs` | PASS: **300 passed, 7 skipped, 0 failed**, 38.66 s; all seven skips explicitly require optional DASD; 934 dependency warnings |
| `PYTHONPATH=backend python scripts/check_research_consistency.py` | PASS: participant overlap 0; saved/checkpoint prediction max error 1.67e-16; stored-artifact scope only |
| `PYTHONPATH=backend python scripts/check_gaze_consistency.py` | PASS: saved development arithmetic consistent; `raw_data_check` unavailable because licensed DASD absent |
| `npm test` | PASS: **94 passed**, 13 files; jsdom media-play notices remain, not physical media coverage |
| `npm run lint` | PASS |
| `npm run build` | PASS; existing >500 kB chunk warning remains |
| `NEUROSENSE_PYTHON=/tmp/neurosense-clean/bin/python NUMBA_CACHE_DIR=/tmp/neurosense-numba-clean npm run test:e2e` | PASS: **4 passed**, 32.6 s; Chromium, real local auth/scoring/disposable persistence, controlled unavailable/denied-camera boundaries |

These local results do not establish GitHub Actions success. Remote acceptance requires a completed successful workflow for the new pushed main commit, checked separately after push. Real webcam and usable-face processing remain unexecuted pending operator observations; see GAZE_EXECUTION_REPORT.md. Next phase: perform the adult operator hardware checklist without altering gates to obtain a desired result.
