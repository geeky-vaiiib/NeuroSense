# NeuroSense gaze model — DASD / OpenFace data report

Model `gaze-openface-dasd-v1` · feature schema `openface-gaze-1.0.0` · trained with `python -m backend.data.train_gaze_openface_dasd` (seed 42, reproducible: two runs gave identical metrics).
OpenFace only measures gaze direction and head pose; the classification is done by the NeuroSense model trained on those measurements. **This is a screening signal, not a diagnosis.**

## Dataset
- DASD (Cai et al., MICCAI 2022). 82 children: **57 ASD, 25 TD** (ADOS-2 labels per README). One OpenFace 2.0 CSV per child, 41,002 frames. No raw video, no age/sex/ADOS score, **no stimulus/task information** (children did the task at home with a parent).
- Labels come from folders only (`abnormal` = ASD, `normal` = TD; counts match the README). Every file is called `normal_<n>.csv`, including those in `abnormal/` — file names are not labels.
- Official split: train 55 (38 ASD / 17 TD), test 27 (19 ASD / 8 TD). Participant = one file; no participant appears in two splits (asserted in code).
- Missing data: 0% NaN in used columns; `success` is 1 on every row (failed frames were already removed, so gaps are the only trace of lost tracking).

## Confounds found in the audit (important)
| | ASD | TD |
|---|---|---|
| mean recording length | 26.2 s (10–66) | 12.6 s (7–19) |
| mean frame rate | 22.4 fps | 24.4 fps |
| mean head distance (pose_Tz) | 507 mm | 414 mm |

Recording length alone gives AUC 0.89–0.92 for ASD vs TD, frame rate alone 0.81. The two groups were therefore probably recorded under different conditions. Mitigations: fixed 6 s windows on a fixed 10 Hz grid; every participant weighted equally; `pose_Tx/Ty/Tz` not used. **These cannot prove the model is free of recording-condition cues.**

## Features and preprocessing (single implementation: `backend/ml/gaze/preprocess.py`)
Features (order): `gaze_angle_x, gaze_angle_y, gaze_vel_x, gaze_vel_y, head_pose_x (pose_Rx), head_pose_y (pose_Ry), head_pose_z (pose_Rz)`.
Pipeline: select columns → timestamp validation → reject no-face / confidence < 0.80 / non-finite or |angle| > 1.2 rad / jumps > 25 rad/s → resample to 10 Hz (gaps > 0.25 s are holes) → features + velocity → 6 s windows (60 steps, 1 s stride, ≥ 80% real steps) → z-score (statistics from training participants only) → BiLSTM → session probability = mean of window probabilities.
Not used / not fabricated: pupil diameter, screen coordinates, calibration.

## Model
BiLSTM (hidden 32, mean+max pooling) → dropout 0.4 → linear → sigmoid. ~13k parameters. AdamW, lr 2e-3, wd 1e-2, class- and participant-balanced loss weights (no SMOTE), noise augmentation, early stopping (CV), threshold 0.5 fixed.

## Validation (dev = official train split, participant-level stratified 5-fold CV)
| variant | AUC mean ± sd |
|---|---|
| gaze + velocity | 0.854 ± 0.190 |
| gaze + velocity, window-centred | 0.812 ± 0.085 |
| **gaze + velocity + head pose (selected)** | **0.911 ± 0.089** |

Selected variant, per-fold (n≈11 each): AUC 1.00 / 0.92 / 0.88 / 1.00 / 0.76; accuracy 0.87 ± 0.05, sensitivity 0.95 ± 0.07, specificity 0.67 ± 0.21, precision 0.89, F1 0.91.
Context baselines (dev CV only): recording duration alone AUC 0.89; **logistic regression on window summary statistics AUC 0.975 ± 0.033 — higher than the BiLSTM.** The signal is mostly "how much gaze/head move"; the LSTM adds little over simple statistics on 55 children.

## Test (official test split, used once; participant level, n = 27)
Accuracy 0.926 · Precision 1.000 · Recall/Sensitivity 0.895 · Specificity 1.000 · F1 0.944 · ROC-AUC 1.000 · Confusion matrix TN 8, FP 0, FN 2, TP 17 (window-level accuracy 0.883). Only 8 TD children: confidence intervals are very wide (specificity 8/8 has a 95% lower bound near 0.63). Test AUC 1.0 is better than any CV fold average and should not be expected to hold on new data.
Train resubstitution (54 children, one TD child produced no usable window): 1.00 — the model fits the training set perfectly.
Figures: `gaze_confusion_test.png`, `gaze_confusion_cv.png`; history `gaze_training_history.json`; all folds `gaze_cv_results.json`.

## Limitations
1. **No webcam validation yet.** OpenFace was not installed in the development environment, so the NeuroSense webcam → OpenFace → model path has been tested only with a stub OpenFace and with DASD CSVs. `backend/data/validate_webcam_domain.py` implements the domain-match check with pre-set thresholds; until it passes, gaze is shown but **not counted in fusion**.
2. DASD stimulus/task and camera setup are unknown and differ from the 30 s NeuroSense picture task; DASD classes differ in recording duration, frame rate and camera distance.
3. 82 children; no age/sex/severity; single dataset; no external validation.
4. Explanation is feature ablation (change in session probability when one feature is set to its training mean) — descriptive of the model, not causal.
