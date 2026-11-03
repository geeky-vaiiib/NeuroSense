# Focused gaze execution phase — 2026-11-03

Baseline verified locally: `62c885c3aaaab6a857ac719aa612906f5d1de6cf`, `main`, clean working tree, origin `https://github.com/geeky-vaiiib/NeuroSense.git`. Fetched and pulled with `--ff-only`; no divergence. No branches created, scoring changed, gates weakened, models replaced/retrained, production database connected or deployment performed.

## Confirmed defects and changes

* Unmount previously called `MediaRecorder.stop()` while its upload-producing `onstop` remained attached. Skip stopped tracks without detaching recorder handlers; pending camera acquisition could resurrect a stopped tracker. A numbered attempt now owns capture callbacks; abandonment invalidates it, detaches handlers before stopping, releases tracks/frame callbacks/timers/listeners, aborts status/upload/poll requests, and discards raw chunks. Late permission/analysis responses cannot change a later attempt. MediaPipe sends are serialized and callbacks remain associated with the sending tracker.
* Recorder error, unexpected stop, track ending, hidden tab and overlong delayed task now fail explicitly and discard partial capture. Countdown/task have explicit Skip. Back/navigation/unmount uses the same cleanup. Setup is visibility/position/lighting only, never screen calibration. A task must finish normally before it can upload.
* Upload/polling/delays were not interruptible and polling failure lost the accepted ID. `gazeApi.analyze` now accepts AbortSignal, received job ID and acceptance callback. Resume polls that ID with no Blob/upload. Stop waiting aborts browser activity only; the accepted backend job may continue. The job ID survives within the mounted flow, not navigation/reload. No raw video enters localStorage/IndexedDB. Poll errors distinguish timeout/network/401; server insufficient-quality/out-of-domain/unavailable are completed analysis outcomes, not request failures.
* A lost/invalid upload response has **unknown acceptance**. No automatic upload retry occurs. The user may explicitly make a new recording or skip; an ID is necessary to resume. This is not upload idempotency or backend cancellation. Upload has a 120-second browser deadline; polling retains its 10-minute wait budget per resume.
* Old normalization unconditionally used decoded-frame-count / client wall time. New `media-pts-cfr-v1` normalization uses FFprobe decoded presentation timestamps, cross-checks client time, and records provenance. The frozen model/preprocessing windows, sampling grid, quality thresholds and domain gates are unchanged. Accepted runtime inputs can differ from old incorrectly timed inputs; this correction is explicit, not a model replacement.
* Quality percentages formerly defaulted missing values to zero. Missing recording summary values now show Unavailable. Tracked span is labelled separately from media duration. UI/PDF distinguish tracking quality, angular/head movement, domain compatibility and experimental output. No calibrated screen location, eye-contact duration, fixation/attention-to-stimulus or diagnostic confidence is claimed. Timing/processing durations are copied into saved gaze features and timing/quality/movement into PDF. A regression verifies they do not alter the questionnaire-only result.

## Timing policy

Requires host **FFmpeg/FFprobe** (backend image already installs FFmpeg; CI now does explicitly). Nominal container FPS is never authoritative. Explicit decoded frame `pts_time` values are required; decoder-generated best-effort timestamps are not used as a fallback. Decode count must match FFprobe frame count; at least two finite, strictly increasing timestamps are required. Duration estimate = last PTS − first PTS + median positive inter-frame interval. The endpoint interval is **estimated**, not directly measured frame exposure. Source/normalization version, frame count, dimensions, derived cadence, maximum gap and optional client elapsed time are stored.

Reject duration >180 seconds, >21,600 decoded frames, derived cadence outside 1–120 Hz, gap >max(250 ms, 3×median interval), or interval coefficient of variation >0.2. If client duration exists, reject non-finite/non-positive values or disagreement >max(1 second, 10% media duration). Missing client duration is allowed when media evidence suffices. Short readable clips continue to the existing quality gate; corrupt/missing/unreliable timestamp evidence fails explicitly. Missing FFprobe is service unavailability, never a guessed FPS.

For accepted near-regular clips, all frames are re-encoded as MJPEG AVI with a single cadence `frame_count / estimated_media_duration`, because OpenFace derives timestamps from that cadence. This preserves the existing frame-based preprocessing contract but approximates individual frame timing. Highly irregular VFR clips are rejected rather than silently resampled into an apparent normal recording. These tolerances are conservative engineering limits, **not validated scientific thresholds**. This phase does not certify every browser codec/timestamp implementation. Client elapsed time/visibility checks cannot prove a recording was uninterrupted; server timing and quality checks remain necessary.

## Real-service fixture evidence

Reproducer: `PYTHONPATH=. /tmp/neurosense-clean/bin/python scripts/smoke_gaze_runtime.py` (use the documented locked venv on another machine). Generates explicitly synthetic uniform-gray clips locally, never participant images or manufactured gaze/head motion. Uses mongomock, real FFmpeg/FFprobe, real OpenFace and the frozen service; manually seeded durable job boundary, not an HTTP/camera test. Machine-readable results: `docs/evidence/gaze_execution_fixture.json`. It leaves only synthetic input fixtures/evidence under /tmp; private upload/intermediate spool is empty afterward.

* Host macOS 26.6.2 arm64; Python 3.11.14; sklearn 1.6.1, XGBoost 2.1.4, torch 2.6.0; FFmpeg 9.0.2. OpenFace runs **Linux amd64 under Docker emulation**, not native Apple silicon.
* OpenFace image `algebr/openface@sha256:f43ad4e7fa4530143c7a9e0e8eca7e4f2b45599c1ef19680b68ad1eebba05197`. Exact internal semantic binary version was not separately established; image identity is pinned in evidence. The image lacks ffprobe, so host FFmpeg was installed for this phase (no Python-lock changes).
* Frozen model `gaze-openface-dasd-v3`, SHA-256 `b3899134d927af0013ba68e9c045c41aaf443e3de8cb2a227719b4043300a8d9`, successfully loaded. Models/scoring/gates remain unchanged.

| Real fixture | Media evidence | Stage timings (seconds) | Outcome / cleanup |
|---|---|---|---|
| VP8 WebM | 30.0 s estimated from PTS, 450 frames, 320×240, 15 Hz, max gap .067 s | Normalize 0.39; OpenFace 3.083; preprocessing/gate 0.004; total 3.481 | `insufficient_quality`, `face_not_detected`, 0/450 valid frames; model output null; raw deleted, spool empty |
| H.264 MP4 | 30.0 s estimated from PTS, 450 frames, 320×240, 15 Hz, max gap .066667 s | Normalize 0.182; OpenFace 2.079; preprocessing/gate 0.002; total 2.264 | Same honest quality rejection and cleanup |

Quality failure means domain compatibility and model inference were **not evaluated** for these clips. Frozen weights loaded is not equivalent to passing a usable-face inference smoke. No gate was bypassed to obtain a score. Model/quality behavior on existing numeric DASD fixtures is covered separately in backend tests, not mislabelled as new webcam evidence.

## Automated checks and coverage

Commands executed on the working implementation:

* `MONGODB_URI=mongomock://tests NUMBA_CACHE_DIR=/tmp/neurosense-numba-clean PYTHONPATH=backend /tmp/neurosense-clean/bin/python -m pytest backend/tests -q`: **299 passed**, 934 dependency warnings, 26.21 s. All storage/spools isolated. Includes controlled ffprobe timestamp/malformed-duration/count tests, real FFmpeg WebM/MP4 2-second codec tests, fake OpenFace boundaries, actual frozen checkpoint/numeric preprocessing tests, lifecycle/ownership regressions and unchanged questionnaire results.
* `npm test`: **94 passed**, 13 files, 2.25 s. MediaRecorder/FaceTracker/axios/fetch are controlled boundaries in new unit tests, not hardware. Covers permission/no-camera/in-use mapping, late camera acquisition, countdown/recording unmount and Skip, backgrounding, delayed timers, unexpected stop, recorder/track failure, late analysis, poll abort, accepted-ID resume and ambiguous upload behavior.
* `npm run lint`; `npm run build`: pass; existing >500 kB build warning remains. jsdom reports its unimplemented media play method during mocked capture tests; this is not real media playback coverage.
* `NEUROSENSE_PYTHON=/tmp/neurosense-clean/bin/python NUMBA_CACHE_DIR=/tmp/neurosense-numba-clean npm run test:e2e`: **4 passed** in Chromium at 390×844, 35.1 s. Real local frontend/backend and throw-away auth/storage; gaze unavailable response and camera denial are mocked browser boundaries. Child/adult/toddler saved-result/refresh/PDF/retry flows plus denied-camera retry/skip with zero uploads. No physical camera permission/stream was tested.

## Real camera/operator test — NOT RUN

No consenting adult operator/camera interaction was available to this agent. Do not call the module fully verified. Exact next steps:

1. In the locked local environment, configure the recorded trusted OpenFace image/native binary and FFmpeg/FFprobe; use disposable storage and matching HTTPS/localhost hostnames. Register an adult operator with informed consent for technical capture only.
2. Enter a supported questionnaire, reach gaze, deny camera, retry/allow. Confirm face/lighting setup checks, 3-second countdown and full 30-second visible-tab task. Do not deliberately manufacture movement to pass the gate.
3. Repeat Skip during countdown/recording, browser Back/navigation, disconnect camera and hide the tab. Verify camera indicator turns off, partial captures do not upload and a new complete attempt is required.
4. Finish a normal recording; inspect upload/accepted ID/stages, timing source and dimensions/frame count. Interrupt polling then resume the same ID with **no second upload**. Stop waiting and verify the UI says server computation may continue. A lost upload response must remain ambiguous, not auto-retry.
5. Compare real quality/tracked span/media duration, angular measurements, domain outcome and withheld/experimental model output with saved case, reopened result and PDF. Questionnaire result must be unchanged. Inspect private spool after success/failure/rejection and record actual cleanup.
6. Record OS/browser/camera/tool versions, artifact/image hashes, processing-stage durations and actual outcomes. If a usable recording fails domain/quality gates, retain that outcome. Follow the fuller crash/ownership/accessibility checklist in HARDWARE_SMOKE_TEST.md before participant collection.

## Research/operational limits

No clinical validity, population autism probabilities, calibrated screen gaze, fixation duration or stimulus-specific attention follows from these checks. Dataset/source confounding, demographic/task mismatch, held-out reuse, permission/ethics and independently assessed external validation requirements remain in SCORING_AND_EVIDENCE.md. MediaPipe remains a shared setup model; a hung native/WASM in-flight call cannot be forcibly cancelled and may require reload. Browser abort does not cancel FFmpeg/OpenFace or release backend concurrency slots early. Job lease/timeout/process-local admission and retention limits remain in RUNTIME.md. Raw drafts/job IDs are not recovered after leaving the mounted flow.

FFprobe command semantics reference: [official FFprobe documentation](https://ffmpeg.org/ffprobe.html), accessed 2026-11-03. Frame/stream inspection supplies media timestamps; this policy does not establish exposure timing or participant attention.

## Linux runtime attempt and final verification

Executed `docker build --platform linux/amd64 -f deploy/Dockerfile.backend -t neurosense-gaze-smoke:local .` successfully; a final cache-backed rebuild included the current backend. Initial build took over eight minutes and fetched the existing lock's large CUDA dependencies despite CPU inference. No runtime pins or model files were changed to avoid that cost. Final local image manifest: `sha256:d276b730eb002c39d7ca2d485aa49e26c05573ecc2e39c4f0af6d358d39459da`.

Ran `docker run --rm -i --platform linux/amd64 --network none` with disposable `mongomock://linux-smoke`, a disposable JWT secret, warmup disabled and synthetic fixtures mounted read-only. Passed: Python 3.11.14, `/ready`, registration, server score 6 with only questionnaire in result, actual WebM normalization (450 frames, 30 s, 320×240, 15 Hz, version media-pts-cfr-v1), Debian FFprobe 5.1.9. Evidence: `evidence/gaze_linux_smoke.json`. This is an emulated Linux container dependency/core-media smoke, not native-host load testing, real persistent MongoDB integration, OpenFace inside the backend image, or full Linux browser/hardware acceptance. No Docker socket or production credentials were mounted; container removed itself after the test. Images remain local, not published/deployed.

Also generated a real one-page A4 PDF using the measured blank-fixture timing/quality (synthetic QA metadata), rendered with Poppler and visually inspected: no clipping/overlap; null/unavailable fields and quality-versus-confidence wording retained. Unit export checks include the timing version and media duration. No participant PDF or recordings are committed.
