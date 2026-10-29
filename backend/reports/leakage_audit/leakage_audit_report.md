# Gaze model — recording-context and duration leakage audit

Reproduce: `python -m backend.data.audit_gaze_leakage` (≈ 15 min). Raw numbers: `leakage_audit.json`, per-child metadata: `dev_metadata.csv`.
Scope: the 55 official-train (development) children only; the previously examined test split is not read. Every model uses identical folds: stratified participant-level 5-fold × 10 repeats (seeds 101–110). v2 and v3 checkpoints were not touched (v2 SHA-256 verified; no checkpoint saved by this audit). AUC CIs are 2000× participant bootstrap of the repeat-averaged out-of-fold probabilities; fold-level AUCs are in the JSON (each fold has ~11 children, so a single fold AUC is very noisy).

## Decision rule (written in the script header before the first run)
v3 shows evidence of learning gaze-related patterns beyond collection context only if all hold:
(1) paired CI of AUC(v3) − AUC(best metadata-only control) is > 0 · (2) donor-swap control CI includes 0.5 · (3) duration-equalised variants stay clearly above the metadata controls · (4) label permutation ≈ 0.5.

## 1. Collection-context audit (dev, 55 children: 38 ASD / 17 TD)
| variable | ASD median | TD median | AUC if used alone [95% CI] | MWU p |
|---|---|---|---|---|
| recording duration (s) | 21.5 | 12.4 | **0.89** [0.79, 0.96] | 4e-6 |
| frame count | 488 | 305 | 0.85 [0.73, 0.94] | 4e-5 |
| 10 Hz grid steps | 216 | 125 | 0.89 [0.80, 0.96] | 4e-6 |
| usable windows | 14 | 7 | 0.80 [0.68, 0.91] | 4e-4 |
| frame rate (fps) | 23.8 | 25.0 | 0.26 (= 0.74 reversed) [0.13, 0.40] | 4e-3 |
| longest timestamp gap (s) | 0.68 | 0.04 | 0.82 [0.69, 0.92] | 2e-4 |
| fraction of time in tracking holes | 3.8% | 0% | 0.72 [0.59, 0.85] | 6e-3 |
| windows containing filled holes | 43% | 0% | 0.71 [0.56, 0.85] | 1e-2 |
| mean OpenFace confidence | 0.961 | 0.966 | 0.33 [0.18, 0.49] | 0.04 |
| share of frames at the confidence cap | 73% | 82% | 0.31 | 0.02 |
| valid-frame ratio | 99.7% | 100% | 0.34 | 0.05 |
Reading: ASD and TD recordings differ systematically in **length, frame rate, tracking gaps and confidence** — the collection process was not matched between groups. (Note: all DASD frames have success = 1; failed frames were removed before release, so gaps are the only missingness signal.) Boundary check (gaze-x SD): in both classes the first 6 s are calmer than the rest (ratio first/rest 0.55 ASD, 0.69 TD).

## 2. Can the BiLSTM read length, padding, masks, boundaries, missingness?
By construction it receives fixed 60-step windows with no padding, no mask and no length input; holes are filled inside the window (with the window mean) and windows with < 80% real steps are dropped. Per-child training weights are equalised, and the session score is a mean of window probabilities. So the *architecture* has no direct length channel; the empirical test is the **donor-swap control**: every child keeps its own timeline, hole pattern, number of windows, label and recording boundaries, but its gaze values are replaced by those of a random other child.
→ AUC **0.531 ± 0.068 [0.34, 0.74]**: the network cannot recover the label from length / holes / boundaries / hole-fill artefacts. Label permutation (labels shuffled, same folds): **0.487 ± 0.073** (pipeline is not leaking labels). Both controls behave as they should.

## 3. Participant-level CV comparison (dev, 10 × 5-fold)
| model | n | AUC mean ± sd (repeats) | 95% CI | sens | spec | fold AUC mean ± sd [min, max] |
|---|---|---|---|---|---|---|
| metadata-only LR: duration | 55 | 0.887 ± 0.006 | 0.79–0.97 | 0.80 | 0.95 | 0.90 ± 0.09 [0.67, 1.00] |
| metadata-only GB: duration | 55 | 0.877 ± 0.022 | 0.80–0.97 | 0.83 | 0.75 | 0.87 ± 0.10 [0.62, 1.00] |
| metadata-only LR: length set | 55 | 0.875 ± 0.007 | 0.78–0.96 | 0.82 | 0.92 | 0.88 ± 0.10 |
| metadata-only LR/GB: frame rate/timing | 55 | 0.723 / 0.658 | 0.51–0.81 / 0.49–0.79 | | | |
| metadata-only LR/GB: missingness | 55 | 0.693 / 0.646 | 0.48–0.78 / 0.47–0.78 | | | |
| metadata-only LR/GB: confidence | 55 | 0.644 / 0.615 | 0.46–0.79 / 0.43–0.79 | | | |
| **metadata-only LR: ALL metadata** | 55 | **0.898 ± 0.020** | 0.80–0.97 | 0.83 | 0.82 | 0.91 ± 0.10 [0.71, 1.00] |
| **metadata-only GB: ALL metadata** | 55 | **0.900 ± 0.024** | 0.84–0.98 | 0.86 | 0.76 | 0.92 ± 0.08 [0.68, 1.00] |
| **v3 (gaze-only BiLSTM, as deployed)** | 55 | **0.896 ± 0.020** | 0.76–0.99 | 0.89 | 0.80 | 0.92 ± 0.09 [0.71, 1.00] |
| 3 evenly spaced windows per child | 55 | 0.913 ± 0.018 | 0.82–1.00 | 0.85 | 0.87 | 0.92 ± 0.09 |
| window-centred (no session mean) | 55 | 0.868 ± 0.024 | 0.73–0.98 | 0.87 | 0.76 | 0.88 ± 0.11 |
| crop: first 7 s only (equal duration) | 51 | 0.840 ± 0.040 | 0.76–0.96 | 0.77 | 0.76 | 0.87 ± 0.12 [0.29, 1.00] |
| crop: middle 7 s only | 45 | 0.708 ± 0.046 | 0.56–0.87 | 0.66 | 0.69 | 0.70 ± 0.15 |
| crop: last 7 s only | 53 | 0.633 ± 0.067 | 0.55–0.88 | 0.83 | 0.30 | 0.70 ± 0.18 |
| **DONOR SWAP (control)** | 55 | **0.531 ± 0.068** | 0.34–0.74 | 0.65 | 0.39 | 0.54 ± 0.22 |
| **TIME-SHUFFLED within child** | 55 | **0.934 ± 0.016** | 0.88–0.99 | 0.88 | 0.88 | 0.94 ± 0.06 |
| LABEL PERMUTATION (control) | 55 | 0.487 ± 0.073 | | | | |
Crop rows use only 2 windows per child, drop children without enough usable frames (n < 55) and shrink the training set, so they are **not** a clean "same information, equal duration" test; the 3-evenly-spaced-windows row (all 55 children, equal window count, spans the whole session) is the cleaner equalisation and loses nothing (−0.034 [−0.093, +0.010] vs v3).

## 4. Paired tests (participant bootstrap; difference = AUC(v3) − AUC(other))
- vs metadata-only ALL (LR): −0.005 [−0.153, +0.134]; vs ALL (GB): −0.026 [−0.164, +0.094]; vs duration only: +0.005 / −0.003 (CIs ±0.15). **v3 is not distinguishable from — and not better than — what recording metadata alone achieves.**
- vs timing / missingness / confidence controls: +0.22 to +0.29 (CIs exclude 0). v3 does beat those weaker context controls, but the strongest context variable is duration.
- vs donor swap: +0.354 [+0.098, +0.593] — v3's result depends on the gaze content.
- vs time-shuffled: −0.056 [−0.148, +0.010] — shuffling the temporal order does not hurt (it nominally helps).
- Duration-matched subset (children whose duration lies in the range both classes share, 10.3–17.8 s; **n = 21**: 8 ASD, 13 TD): v3's out-of-fold probability AUC = **0.95 [0.82, 1.00]**, whereas duration AUC there = 0.33 and fps AUC = 0.23 (no signal in the wrong-way direction). Adding the frame-rate overlap changes nothing (same 21). Small sample, but within matched durations the ranking is preserved.

## 5. What the model uses
- **Temporal order is irrelevant**: shuffling each child's values in time (keeping the distribution and holes) gives AUC 0.934 vs 0.896. The network is using the *distribution/spread* of the session-centred gaze direction (how widely the child's gaze/head direction varies), not gaze dynamics, fixations or scanpaths. (Consistent with the earlier attenuation probe: shrinking movement drives the score down.)
- It does **not** read duration, window count, holes or boundaries (donor swap 0.53).

## 6. Diagnosis
1. **Direct leakage into the network via length / padding / masks / boundaries / missingness: not found** (donor-swap 0.53, label-permutation 0.49; architecture has no such channel).
2. **Collection-context confounding: present in the data and not excluded.** ASD and TD recordings differ strongly in length, frame rate, gaps and confidence; metadata alone reaches AUC 0.90 = v3. v3 shows **no demonstrable advantage over metadata** (criterion 1 fails: −0.005 [−0.15, +0.13]). Criterion 3 is not met (equal-duration crops are comparable at best and clearly worse for middle/last crops, partly because of less training data). Criteria 2 and 4 pass.
3. v3's score is driven by **movement/gaze-direction spread**. Within duration-matched children this ranks well (0.95, n = 21), which argues against duration being the mechanism, but movement spread can still co-vary with unrecorded context (camera set-up, stimulus, device, age, session protocol). Nothing in DASD lets us test that.

**Verdict — NOT demonstrated.** v3 does not read collection metadata through its inputs, but the data do not show that it learns ASD-related gaze behaviour as opposed to movement amplitude that tracks how and where the groups were recorded. Neither is it refuted. It stays an experimental, display-only signal; the audit passing criteria 2 and 4 is not a reason to enable fusion, and webcam-domain and labelled deployment validation remain separate requirements.

## 7. Revised preprocessing / evaluation recommendation (not applied to v2/v3)
1. Keep fixed 6 s windows on the fixed 10 Hz grid and window-mean aggregation; keep duration, frame count, fps and quality as **QC outputs only, never model inputs**.
2. For any new training run: equalise per-child contribution (already done by weights) and optionally cap/evenly sample N windows per child (3 evenly spaced windows lost nothing); evaluate duration-matched subsets alongside the full set.
3. Because temporal order is not used, test **unordered window-bag / distribution models** (e.g. per-window spread statistics, quantile features) — they are simpler and the 0.93 shuffled result suggests they will match the BiLSTM. Do not claim "dynamics".
4. Make `audit_gaze_leakage` a required gate for any new gaze model: report metadata-only controls, donor swap, label permutation and a duration-matched subset next to every headline AUC; claim learning beyond context only when the pre-declared criteria hold.
5. Prefer data that removes the confound rather than modelling around it: groups recorded with the same device, protocol, stimulus and duration (e.g. the NeuroSense 30 s task on matched children).
