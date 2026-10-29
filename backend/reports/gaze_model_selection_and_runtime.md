# Gaze module — model selection, runtime and reliability report

Reproduce: `python -m backend.data.compare_gaze_models` · `python -m backend.data.train_gaze_v3` · `OPENFACE_DOCKER_IMAGE=algebr/openface python -m backend.data.benchmark_gaze_runtime --video-dir <dir>`.
Raw results: `model_selection/model_comparison.json`, `runtime_benchmark.json`, `runtime_benchmark_300frames_warm.json`.
**Gaze is still excluded from the final fusion, and this report does not change that.**

## 1. Audit of v2 before any change
- `gaze-openface-dasd-v2`: BiLSTM (hidden 32), 5 session-centred inputs (gaze x/y + head pose x/y/z), 10 Hz, 6 s windows, trained on the 55 official-train children, epochs 11, seed 42; mean-of-windows session score; per-session domain gate (robust z of log within-session std, in ≤ 3 < marginal ≤ 6 < out); fusion needs ≥ 10 good in-domain lab sessions.
- Findings that shaped this work: (a) the v2 "test" numbers (AUC 0.967, spec 0.625) come from a split that had already been examined for v1/v2 design → **not an untouched evaluation**; (b) v2's checkpoint was uncommitted on disk → frozen as `models/baseline/gaze-openface-dasd-v2/` with `SHA256SUMS`, verified byte-identical at the end of this work and by a unit test; (c) the old training script would have overwritten v2 on re-run → now writes only to `models/reproduction/`.

## 2. Model comparison (same folds for every model)
Protocol (pre-declared in the script header): dev = the 55 official-train children only (test split never loaded); stratified participant-level 5-fold × **10 repeats** (seeds 101–110); fixed hyper-parameters (no tuning); session-level models use the median over 6 s windows of robust window statistics (std, range, IQR, mean |v|, p95 |v|; duration-independent); BiLSTM = v2 recipe with inner early-stopping split. Metric = pooled out-of-fold participant-level AUC per repeat; CI = 2000× participant bootstrap of repeat-averaged OOF probabilities; differences are paired.

| model / inputs | AUC (mean ± sd over repeats) | 95% CI | sens | spec | ΔAUC vs v2 config (95% CI) |
|---|---|---|---|---|---|
| LR / gaze | 0.812 ± 0.016 | 0.69–0.94 | 0.75 | 0.80 | −0.083 (−0.161, −0.011) |
| GB / gaze | 0.801 ± 0.025 | 0.67–0.92 | 0.83 | 0.61 | −0.097 (−0.201, −0.010) |
| **BiLSTM / gaze** | **0.896 ± 0.020** | 0.76–0.99 | 0.89 | 0.80 | −0.011 (−0.049, +0.016) |
| LR / head | 0.813 ± 0.020 | 0.70–0.92 | 0.71 | 0.74 | −0.086 (−0.188, +0.010) |
| GB / head | 0.850 ± 0.032 | 0.76–0.95 | 0.86 | 0.58 | −0.035 (−0.133, +0.062) |
| BiLSTM / head | 0.920 ± 0.017 | 0.87–0.99 | 0.88 | 0.79 | +0.039 (−0.006, +0.110) |
| LR / gaze+head | 0.830 ± 0.019 | 0.72–0.93 | 0.73 | 0.71 | −0.070 (−0.159, +0.010) |
| GB / gaze+head | 0.834 ± 0.028 | 0.73–0.94 | 0.84 | 0.58 | −0.056 (−0.153, +0.024) |
| BiLSTM / gaze+head (= v2 config) | 0.901 ± 0.019 | 0.79–0.99 | 0.90 | 0.84 | — |
| reference: recording duration only (leaky) | 0.892 | | | | |
| reference: one statistic, head-yaw SD, no model | 0.704 | | | | |

Reading it honestly:
1. **Session-level LR / GB are worse than the BiLSTM** (≈ −0.05 to −0.10 AUC, intervals mostly exclude 0). The sequence model trains on many windows per child; 44 summary rows per fold are too few. My earlier "LR 0.975" was a single-seed artefact (already retracted).
2. **Gaze-only, head-only and gaze+head BiLSTMs are not distinguishable** (all paired intervals include 0). Head-only has the highest mean and the narrowest interval, but not significantly.
3. **Every model's AUC is statistically indistinguishable from recording duration alone (0.89).** Windows remove duration as an input, but this is a warning that dataset context (who was recorded how, where) may carry much of what is learned.
4. CIs are ±0.1 wide with 55 children; small differences cannot be resolved.

**Selection (pre-declared one-SE rule, simplest within 1 bootstrap-SE of the best):** best = BiLSTM/head-only 0.920 (SE 0.031, threshold 0.889); eligible = the three BiLSTMs; chosen = **BiLSTM / gaze-only (2 inputs)**.
Consequences: `gaze-openface-dasd-v3` = gaze_angle_x/y, session-centred, trained on **all 82 children** (epochs 14 = median dev-CV early-stopping epoch). It needs fewer camera-dependent inputs than v2 (head pose is no longer a model input; the gate still checks head movement). Evidence for v3 is CV only: dev CV (55) AUC 0.896 [0.76, 0.99]; supplementary CV on all 82 children AUC 0.932 ± 0.007 (acc 0.893, sens 0.918, spec 0.836 ± 0.10) — descriptive, because the 27 official-test children influenced earlier design decisions. **No untouched final test exists, and none is claimed.** Because the difference to v2 is not significant, v2 remains registered and selectable (`GAZE_MODEL_VERSION=gaze-openface-dasd-v2`).

## 3. Preprocessing consistency
One implementation (`ml/gaze/preprocess.py`), parameterised by a frozen `PreprocessConfig` per model version (`config.MODEL_CONFIGS`); the service refuses a checkpoint whose stored config differs. The new session-level summary code (`ml/gaze/summary.py`) is built from the same windows. Unit tests cover feature order, session-centring invariance to camera offset, missing data, windows, normalisation. The v2 domain-gate numbers were verified identical after the refactor (−7.22, −6.58 on two webcam sessions). The gate now always uses all five gaze/head channels (even for the 2-input v3) so that head-movement context is still checked.

## 4. Runtime (measured; MacBook M4, Docker Desktop with Rosetta amd64 emulation, OpenFace 2.x image)
Full 30 s session, 900 frames 640×480 @ 30 fps (synthetic moving face from one photo; median of 3):
| stage | seconds |
|---|---|
| video normalisation (re-encode, fps from client duration) | 2.86 |
| **OpenFace FeatureExtraction** | **14.37** (16.0 ms/frame; 82% of the time) |
| CSV parse + preprocessing + quality/domain gate | 0.03 |
| model inference (13–25 windows) | 0.003 |
| feature-ablation explanation | 0.004 |
| container start | 0.19 |
| **total** | **≈ 17–19** |
OpenFace time is linear in frames (100→150→300→900 frames: 2.1 → 2.8 → 4.9 → 14.4 s). A frame with no face costs ~6 ms (300 no-face frames: 1.7 s). Cold start after restarting Docker Desktop: 6.7 s vs 5.2 s warm. The 2-minute figures seen earlier were a **one-time first-run cost of the image**, not steady state; startup warm-up (`openface.warmup()`, background thread, `GAZE_WARMUP=1`) now covers it. Each job now returns measured `timings_s` (normalise / openface / preprocess+model / total).
Limitation: timings use a synthetic, easy-to-track face; real children moving a lot may cost more per frame (not measured — no real video is retained).

**Reducing resolution / frame rate** (same synthetic video; features compared on the model's 10 Hz grid vs 640×480@30; `runtime_benchmark_300frames_warm.json`):
| variant | OpenFace s (300 f) | Pearson r gaze x / y | head x / y / z | MAE ÷ DASD median SD (gaze y worst) |
|---|---|---|---|---|
| 480×360 @30 | 4.6 | 0.985 / 0.949 | 0.998 / 0.996 / 0.999 | 0.104 |
| 320×240 @30 | 4.4 | 0.980 / 0.947 | 0.997 / 0.995 / 0.999 | 0.098 |
| 640×480 @15 | 2.8 (−43%) | 0.983 / 0.969 | 0.996 / 0.990 / 0.998 | 0.049 |
| 640×480 @10 | 2.1 (−57%) | 0.949 / 0.961 | 0.987 / 0.955 / 0.994 | 0.059 |
Resolution reduction saves ≤ 10% and shifts gaze-y; frame-rate reduction saves up to 57% with small differences, but this evidence is synthetic (single face, smooth motion) and DASD's own frame rates (14–25 fps) are not 30 either. **Not adopted**: absolute gain is ~6–9 s per session and the real-motion behaviour is unvalidated; revisit only after a validation on real recordings.

**Native / non-emulated runtime.** Only an amd64 OpenFace image is available (algebr/openface; no arm64 build). A native arm64 build would need cmake, OpenCV, dlib, Boost, TBB (none installed), source patches for SSE flags, and would be a different OpenFace build from the one that produced the features validated here (the DASD features are OpenFace 2.0) — a feature-semantics risk. Because emulated time is already ~19 s/session, **I did not build one**. Recommended production setup: the same image on a Linux x86-64 host (native, no emulation), then re-run the benchmark there.

## 5. Failure modes (all return an explicit state, never a fallback probability)
| condition | result |
|---|---|
| OpenFace missing / Docker down / crash | `unavailable`, `GAZE_OPENFACE_UNAVAILABLE/FAILED`; descriptive/quality absent |
| corrupt video, no decodable frames | `insufficient_quality`, `GAZE_CORRUPT_VIDEO` |
| no face / confidence < 0.8 / too many invalid frames / too short / discontinuous | `insufficient_quality` + codes; real frame counts shown |
| movement far outside DASD range (z > 6) | `out_of_domain`, probability withheld, descriptive + quality still shown |
| movement at the edge of the range (3 < z ≤ 6) | probability computed but flagged, never fusion-eligible |
| model file missing / schema or config mismatch | `unavailable`, `GAZE_MODEL_MISSING/SCHEMA_MISMATCH` |
| webcam validation not passed | probability shown as experimental, not eligible for fusion |
Known modelling risks: duration/context confounds (AUC 0.89 from duration alone), head-movement dominance (gaze x ≈ head yaw in DASD), young-children-only training data, unknown DASD stimulus, extrapolation to very still users (probe: P→ floor).

## 6. Product behaviour when classification is not eligible
Every result with usable frames carries `quality` (usable/total frames, duration, continuity, confidence, data-quality score) and `descriptive` (head turn/nod/tilt and gaze direction: SD, typical range, mean speed, in degrees, plus a disclaimer that they are not diagnostic, not compared with other children and not used in the result). Shown on the recording screen and the results page for every gaze status. Runtime `timings_s` is returned per job.

## 7. Webcam sessions so far (4 adult lab sessions; no labels)
v3: two out_of_domain (z = −6.9, −6.3), two marginal (−5.9, −5.7); v2: three out, one marginal. Head-yaw SD in these sessions 0.33–0.67° (DASD median ≈ 12° for TD children). They are diagnostic of the deployment domain only.

## 8. Final recommendation and remaining validation
- **Model:** `gaze-openface-dasd-v3` (BiLSTM, gaze x/y, session-centred, 10 Hz, 6 s windows) as the default **experimental** model, v2 kept as baseline. Session-level LR/GB are not competitive on this data. Gaze **stays out of fusion**.
- **Before gaze may enter fusion:** (1) ≥ 10 quality-valid, in-domain webcam sessions **of children** (current lab sessions are adults); (2) a labelled, webcam-matched ASD/TD evaluation set (or a prospective study) with an untouched test split — a passing distribution gate is not accuracy evidence; (3) confirmation that real-motion timing/feature behaviour holds on a native x86-64 host; (4) an analysis of dataset-context confounds (e.g. matched duration/setup controls); (5) clinical review of the wording. 
