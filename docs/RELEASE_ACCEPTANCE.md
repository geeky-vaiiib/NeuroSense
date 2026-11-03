# Research-prototype release acceptance

Review completed **2026-11-03 (Asia/Kolkata)**; work began 2026-11-02. Reviewed implementation commit: **`13a26a70bb09a735d93c10ec10789a9c363c6bf3`**, branch **`codex/research-prototype-completion`**. Baseline: `9cfb9b35de2e6f3ad59909562eddeeed2624afad`. This report is a documentation-only follow-up to that implementation commit; it does not change the tested code.

**Verdict: NOT READY for the defined human-participant research-prototype release.** The local prototype is ready for engineering review and its executed technical checks pass. Instrument/electronic-administration permissions, research governance, real recording smoke tests and Linux deployment/runtime verification remain release gates. This verdict does not require or imply clinical validation; no diagnostic, population-probability, production-readiness or clinical-validation claim is made.

## Environment and isolation

* macOS **26.6.2**, **arm64**; Node **25.9.0**, npm **11.12.1**; isolated Python **3.11.14**, FastAPI **0.115.0**, pytest **8.4.2**, sklearn **1.6.1**, XGBoost **2.1.4**, torch **2.6.0**.
* Backend verification environment: `/tmp/neurosense-clean`; writable Numba cache `/tmp/neurosense-numba-clean`. Fresh frontend-install verification: `/tmp/neurosense-frontend-clean`, containing selected frontend sources/configuration and the lockfile, with a fresh `npm ci`.
* Playwright Chromium headless, mobile viewport **390×844**. Real local Vite/FastAPI servers; matching `127.0.0.1` hostnames; disposable accounts and **mongomock only**. Backend unit tests force test configuration before imports, inject a fresh in-memory database and isolated recording spool per test. No real MongoDB was connected, no production data modified, no deployment/merge/push performed, and no models retrained or replaced.
* Docker client/server **29.4.1** was reachable after the local socket permission check. Dockerfile check mode passed. No full Linux image was built or run and no services were deployed.

## Acceptance criteria

PASS means the stated scope was inspected/tested; it does not imply unexecuted hardware, distributed integration or clinical validation. BLOCKED includes unmet release evidence or intentionally unexecuted external/hardware checks, with the dependency stated below. No known failing assertion remains in the final executed suites.

| Criterion | Status | Evidence and boundary |
|---|---|---|
| Current baseline, prior-review verification, isolated branch | PASS | Repository/ancestor instructions inspected; baseline recorded before fixes in COMPLETION_PLAN. Prior PROJECT_STATUS explicitly marked historical. |
| Server questionnaire score alone determines result | PASS | Tampering, item encoding, all totals 0–10, threshold boundaries, result contract and stored/UI/PDF basis checks. Browser sends answers, never a calculated result. |
| Child/adult official cutoff and versioned correction | PASS | ARC forms specify 6; new category-specific AQ scoring v3 uses 6. Legacy training labels remain 7. Version-2 saved basis is retrieved/explained unchanged; no read-time rescoring. |
| Q-CHAT-10 mapping, options, reversed Q10 and cutoff | PASS | Canonical backend definition/export tests, independent item/option tests, all holdout official totals, source comparison; cutoff remains 3, ages 18–24 months. |
| Adult/child/toddler routing, validation, review/edit | PASS | Adult frontend restored; age guards tested; each AQ answer can be reviewed/edited without repeating recordings; toddler can return directly from editing to review. Component and browser checks. |
| Registration/login/logout/session restoration and protected access | PASS | Backend expiry/revocation/active-user checks; component tests; real browser registration, refresh, logout/protected navigation, login and saved-case reopening. Failed logout no longer claims revocation. |
| Ownership, CSRF, role access, legacy ownership | PASS | Backend regressions cover case/job/explanation ownership, cookie-write header, role escalation rejection/DB-resolved roles, clinician-only lab and invisible ownerless historical cases. No real-record ownership migrations performed. |
| Retry preservation and duplicate-case prevention | PASS | Mounted flow retains answers and stable request key. Unique owner/key index stores one case plus exact response atomically; conflict on changed payload. Concurrent insertion test and browser response-loss-after-real-persistence recovery reopen the original case. No-key legacy clients remain non-idempotent. |
| Gaze cross-worker polling, recovery and terminal races | PASS | MongoDB is authoritative; cache miss does not fail live work. Token/lease/deadline CAS tests, old UTC creation-time migration tests, ownership and late-completion rejection. These use shared mongomock/fake processing, not multiple real MongoDB-backed OS workers. |
| Gaze temporary cleanup and truthful timeout behavior | PASS | Success/failure/rejection cleanup and stale-spool/live-lease protection tested. Deadline/poll timeout is not cancellation. Hard-kill leftovers await startup retention cleanup; process-local scheduling limits remain. |
| Optional questionnaire artifacts cannot stop deterministic scoring | PASS | Missing/corrupt/incompatible model/encoder/background tests; actual startup + scoring with broken model; genuine unavailable health/output. Mandatory security configuration failures remain errors. Multiline serialization warnings are rejected, not suppressed. |
| Speech/facial remain measurements, unavailable values honest | PASS | Real fixture WAV decoding/acoustic extraction and image/detection tests; no shipped ASD classifiers. Unvoiced pitch is null with status. Incomplete historical score/outcome stays null with unavailable status. |
| Experimental/cohort models remain outside result | PASS | Result contract regression; toddler model shown separately; gaze eligibility remains false even after a technical domain check. No fusion weights/classifier introduced. |
| Result/explanation/PDF consistency | PASS | Stored score explanation, category-correct LIME labels, explicit positive legacy-label target/local seed, unavailable explanations, all-track PDF text tests and real PDF generation/render inspection. Explanation work no longer blocks session restoration; controlled slow-boundary regression. Model explanation uses the current loaded model, not a historical snapshot. |
| Frontend tests, lint and production build | PASS | 72 tests, 10 files; lint clean; build succeeds with bundle-size warning. Fresh-install checks also pass. |
| Backend full suite in documented runtime | PASS | **282 passed**, no skips/failures in this local checkout; 934 existing dependency deprecation warnings. No sklearn/XGBoost artifact compatibility warnings in the final run. Licensed raw-data tests may skip in CI when DASD is absent. |
| Browser E2E | PASS | **3 passed**: child/adult real local auth, explicit unavailable-gaze fixture/skips, ambiguous retry, refresh, PDF download, history reopening, mobile overflow, logout/login; toddler all answers, review/edit, server score, refresh and PDF. Single browser engine only. |
| Reproducible dependency setup | PASS | Fresh Python install, universal hash-lock sync, matching artifact runtime, 22 unchanged questionnaire prediction fixtures; fresh npm install/tests/lint/build. This verifies macOS arm64, not every platform. |
| Dependency advisory review | BLOCKED | Non-breaking remediation removed reported critical/high findings. `npm audit --omit=dev` reports zero at review time. **Six moderate development-toolchain findings** remain; no forced major downgrade applied. No Python/OS vulnerability audit was performed. |
| CI/deployment configuration and core readiness | PASS | CI, non-root one-worker Dockerfile, nginx/TLS example, env/version files; `/live`, `/ready` and optional-capability health tests. Dockerfile check has no warnings. Configuration prepared only. |
| Full Linux image/runtime, remote CI, load/failure integration | BLOCKED | Not executed. Requires a controlled Linux x86-64 runner/container, image/binary digests, dedicated throw-away persistent-store integration, resource measurements and operator review. Remote CI was not triggered because nothing was pushed. Dockerfile parsing is not an image/runtime smoke test. |
| Real camera/microphone/OpenFace capture and cleanup | BLOCKED | **Not executed** in this review. A trusted, version-recorded OpenFace/FFmpeg installation and approved real recording smoke session are needed. See HARDWARE_SMOKE_TEST. Unit fake boundaries and browser skips are not hardware coverage. |
| Comprehensive accessibility/multiple browsers/Unicode PDF names | BLOCKED | Keyboard/focus/status component checks and a mobile Chromium suite pass. Screen-reader, additional engines/devices, full landscape/layout audit and non-Latin PDF font rendering remain unverified. |
| Instrument permission, research governance and external validity | BLOCKED | ARC/rights-holder applicability for software/electronic presentation/helpers, ethics/consent, retention/deletion, intended-population external evidence and independently assessed labels remain open. Dataset attribution does not supply instrument permission or clinical evidence. |

## Commands executed and actual results

Commands below were run from the repository root unless stated otherwise. Earlier failing/intermediate runs are not represented as passes. Baseline details are retained in COMPLETION_PLAN.

| Command/check | Actual result |
|---|---|
| Baseline `PYTHONPATH=backend python3 -m pytest backend/tests -q` with forced disposable mongomock/JWT config | 237 passed, 3 speech failures in 24.44 s on host Python 3.9.6; sklearn/XGBoost mismatch warnings. |
| Baseline `npm test`; `npm run lint`; `npm run build` | 65 passed; lint pass; build pass with size warning. |
| `NUMBA_CACHE_DIR=/tmp/neurosense-numba ... python3 -m pytest backend/tests/test_speech_facial.py -q` | 9 passed: baseline speech failures traced to unwritable Numba caching, not evidence of classifier output. |
| Isolated Python download/venv + `uv pip compile backend/requirements.txt --universal --python-version 3.11 --generate-hashes --output-file backend/requirements.lock` | Lock generated; no training. |
| `UV_CACHE_DIR=/tmp/neurosense-uv-cache uv pip sync --python /tmp/neurosense-clean/bin/python --require-hashes backend/requirements.lock` | 86 packages resolved/audited in the disposable runtime. |
| `NUMBA_CACHE_DIR=/tmp/neurosense-numba-clean PYTHONPATH=backend /tmp/neurosense-clean/bin/python -m pytest backend/tests -q` | **282 passed, 934 warnings, 23.84 s** in final full run. |
| `npm test` | **72 passed, 10 files**, final root run 1.43 s. |
| `npm run lint` | Pass, no findings. |
| `npm run build` | Pass; final recorded root build 153 ms; >500 kB chunk warning remains. |
| Fresh `/tmp/neurosense-frontend-clean`: `npm ci`, `npm test`, `npm run lint`, `npm run build` | Pass; **72 tests**, lint clean, build successful with size warning. npm reports remaining toolchain advisories. |
| `NEUROSENSE_PYTHON=/tmp/neurosense-clean/bin/python NUMBA_CACHE_DIR=/tmp/neurosense-numba-clean npm run test:e2e` | **3 passed in 25.7 s** in the final expanded suite. |
| `PYTHONPATH=backend /tmp/neurosense-clean/bin/python scripts/check_research_consistency.py` | Pass; output matches committed toddler evidence JSON. |
| `PYTHONPATH=backend /tmp/neurosense-clean/bin/python scripts/check_gaze_consistency.py` | Pass; saved repeat-metric arithmetic and local split inventory match committed evidence JSON. |
| Old/new-runtime deterministic questionnaire fixture comparison | 11 item totals per child/adult track; maximum probability change **0.0**; original artifact hashes preserved; clean loader has no compatibility warnings. Committed fixture regression repeats expected outputs. |
| `node scripts/check_pdf_export.mjs`; `pdfinfo`; `pdftoppm -r 72 -png ...` | Three explicitly synthetic QA PDFs, each two A4 pages; all six pages visually inspected. Stored scores/provenance, unavailable model/status and explanation scope present; no clipping/overlap found. English/Latin fixture coverage only. |
| `npm audit --json`, `npm audit fix`, `npm audit --omit=dev --json` | Initial 17 findings included critical/high. Non-breaking fix updated lock. Six moderate development findings remain; final production-dependency audit zero. Advisory results are time-specific. |
| `docker version ...`; `docker build --check -f deploy/Dockerfile.backend .` | Docker 29.4.1 reachable; check complete, no warnings. No image execution. |
| `git diff --check`; ignored-secret/model-artifact checks | Pass. Secret env file remains ignored. No model checkpoints/pickles or original dataset/report outputs modified; only training-script provenance comments changed. |

## Environment blockers versus code failures

Resolved environment/harness issues: the host's Numba cache path caused the three baseline speech failures; a writable cache resolved them. Old dependency pins caused artifact warnings; the isolated compatible runtime resolves them without rewriting artifacts or suppressing warnings. Sandbox loopback/socket permissions initially blocked browser servers/Docker inspection; authorized local checks subsequently ran. Matching frontend/API hostnames fixed the initial E2E SameSite-cookie harness configuration. Mobile sidebar visibility, consent waiting and exact button selectors were corrected in the test harness.

Confirmed code defects fixed in scope: false cross-worker gaze interruption, non-atomic terminal writes, startup failure on optional artifacts, AQ cutoff mismatch, inaccessible adult flow, duplicate submissions after lost responses, hidden logout failure, recording-step bypass, pending auto-advance overriding manual navigation, missing answer-review controls, absent toddler PDF, misleading UI/PDF/landing claims, incorrect child LIME prose/positive-class handling, blocking explanation work, hidden toddler return-to-review control, and fabricated zero/low defaults for incomplete historical cases. Their affected checks passed after correction. An additional loader regression verifies multiline serialization warnings are treated as unavailable.

Unexecuted checks above are not described as code failures or as passed integration tests. Production database access was expressly excluded throughout.

## Mocked versus real coverage and research evidence

* **Real local application behavior:** browser registration/login/session cookies, server-side score/model dispatch, in-memory persistence/history/retrieval, CSRF headers, result rendering and PDF download. Backend suites use the actual scoring, auth, ownership, acoustic extraction and checkpoint code against isolated storage; local DASD-dependent tests consumed available licensed files.
* **Controlled boundaries:** gaze worker processing substitutes fake normalization/OpenFace/service boundaries; shared-worker behavior uses durable documents plus cleared/local-independent cache state and CAS tests. Browser gaze unavailability is intercepted; speech/facial are skipped in browser E2E. Microphone permission denial is mocked in component tests. Response loss is injected **after** the real screening endpoint persisted a case. These are explicitly mocked checks, not recordings or multi-process MongoDB integration.
* **Real PDFs, synthetic content:** jsPDF output was generated and rasterized, rather than relying solely on mocked text calls. Fixtures are labelled synthetic QA records and are not participant reports. Actual browser downloads were also observed.
* **Independently reproduced research consistency:** toddler 189/63 split with zero saved ID overlap, all 63 checkpoint predictions matching to 1.67e-16, AUC 0.9350913, official-points AUC 0.9158215, Brier 0.1032663 and 2,000-participant bootstrap AUC interval [0.86766, 0.98081]. Gaze local 55/27 split over 82 IDs has zero overlap; mean of ten saved dev AUCs recomputes to 0.8955108359. No training or independent clinical cohort evaluation was reproduced.
* **Inspected/reported only:** nested model-selection training, source-only/temporal controls, full gaze training/calibration claims and reported confidence intervals beyond the explicit recomputation above. Prior holdout inspection, recruitment-source confounding, household/real-world participant identity uncertainty and population mismatch remain limitations.

## Remaining defects, operational constraints and release gates

1. Obtain and record applicable instrument/electronic-use/helper permissions and research ethics/consent/retention approvals before participant collection. No code change substitutes for these decisions.
2. Execute the separate real camera/mic/OpenFace smoke protocol, including denial/retry, usable/poor recordings, timeouts, crash recovery, raw-file cleanup and rendered PDF consistency; record exact browser/tool/model versions and resource measurements.
3. Verify the full Linux x86-64 locked runtime/image, persistent throw-away MongoDB semantics and remote CI in an approved environment. Pin trusted OpenFace and base-image/tool identities. Current deployment configuration is reviewable, not deployed or production certified.
4. Retain one worker/instance until auth throttles, admission limits and OpenFace scheduling are shared/atomic across processes. Shared job CAS/polling does not provide distributed resource limits. mongomock mode is inherently process-local. Wall-clock lease handling assumes reasonably synchronized worker clocks.
5. Timeout does not cancel native computation; slots/files may remain until actual return. Hard-kill leftovers can remain until the two-hour startup spool sweep. No continuously running distributed recovery/cleanup service is claimed. Jobs expire after two hours; saved case copies retain completed analysis.
6. Review the six moderate development-toolchain advisories and add an approved dependency/OS security maintenance process; no forced major change was made here. Bundle-size warning, full accessibility/browser coverage and non-Latin PDF font support remain open.
7. Unsaved drafts/request keys survive retry only within the mounted flow. Fresh navigation/reload loses the draft; clients omitting idempotency keys can still create duplicates. Notes remain browser-local. Model explanations use currently loaded models and approximate Kernel SHAP, while historical questionnaire scoring provenance remains immutable.
8. Intended-population clinical validation, independently adjudicated labels, representative external cohorts, source-confounding controls and untouched confirmatory sets remain external research dependencies. Speech/facial classifiers or any fusion result are unsupported; none was invented.

## Changed files and next phase

The reviewed implementation commit contains the full changed-file inventory (94 files, including lock/configuration/documentation/tests). Main groups: durable gaze jobs/spool and optional loader; canonical scoring/content/provenance; atomic submissions and authentication failure handling; frontend tracks/review/recording/result/PDF flows; regression/browser suites; exact dependency locks, CI/deployment examples and evidence audit. Original model artifacts and datasets remain unchanged.

This acceptance phase adds only this report after the implementation snapshot. Next recommended phase: resolve instrument/governance dependencies and execute the documented real-service/Linux acceptance protocol in a dedicated approved research environment. Keep experimental outputs separate and do not promote technical test success into clinical or production-readiness claims.

## Gaze execution follow-up — 2026-11-03

The follow-up phase is recorded separately in GAZE_EXECUTION_REPORT.md and evidence/gaze_execution_fixture.json. Real blank WebM/MP4 fixtures now passed through local FFmpeg/ffprobe normalization and the pinned Linux/amd64 OpenFace image, with the frozen model loaded. Both correctly failed face visibility/quality; no model output or domain compatibility was invented. Raw and intermediate cleanup was verified. This supersedes only the prior “no real OpenFace fixture processing” gap. **Real webcam/operator capture remains NOT RUN**, and usable-face model/domain runtime acceptance remains open. Clinical/research validity and permissions are unchanged. The original acceptance table above is retained as a dated snapshot.

Linux follow-up: the backend image now builds on Linux/amd64 under emulation. A network-disabled, in-memory core auth/scoring and actual media-normalization smoke passed; see `docs/evidence/gaze_linux_smoke.json`. This supersedes the earlier unexecuted image-build/core-media smoke gap only. Native Linux load/persistent-store/browser/hardware integration remains unverified.
