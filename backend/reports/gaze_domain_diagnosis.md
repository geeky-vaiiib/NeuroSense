# Webcam domain-validation failure — diagnosis

Nothing was relaxed to obtain a PASS: no threshold was lowered, no webcam feature was rescaled, and gaze is **not** in fusion.
Reproduce: `python -m backend.data.diagnose_gaze_domain`, `python -m backend.data.experiment_gaze_representation`.
Data: `reports/domain_diagnosis/` (feature_stats.csv, session_stats.csv, stats.json, experiments.json, 3 figures).

## 1. Root cause
Two separate things, only one of which is a representation bug:
1. **Nuisance offset (fixable, fixed).** The v1 model used absolute gaze/head angles. Webcam means differ from DASD by camera geometry (gaze-y mean 0.08–0.24 vs DASD 0.28–0.56 for TD/ASD 5–95%; head pitch ≈ 0 vs 0.28). On the 4 webcam sessions the v1-style absolute model output P(ASD) = 0.98 / 0.98 / 0.97 / 0.54 for people sitting still; the same model with session-centred inputs gave 0.03–0.09.
2. **Movement scale / population (not fixable by representation).** Within-session movement in the webcam sessions is far below *every* DASD child: head-yaw std 0.006–0.012 rad vs a DASD per-child minimum of 0.097 (TD median 0.22), gaze-x std 0.025–0.032 vs minimum 0.08, head-roll 0.006–0.012 vs 0.032. DASD participants are young children at home; the volunteers are (presumably) adults seated at a laptop. The 4 sessions are therefore not a sample of the deployment population (children) at all.
The first validator also compared pooled DASD std (which contains between-child spread) with within-session webcam std; that is not like-for-like, so it was replaced (section 11), not loosened.

## 2. Raw CSV comparison (DASD vs webcam)
| item | DASD | webcam | match |
|---|---|---|---|
| OpenFace | 2.0 (README) | algebr/openface (OpenFace 2.x), `-gaze -pose` | same family; exact build of DASD not documented |
| shared columns, names, order | 714 columns | 299 columns, identical names and relative order | yes |
| timestamp | seconds, 13.7–25 fps, gaps up to 2.4 s (failed frames removed) | seconds, 30.0 fps, no gaps | units equal; rate differs (handled by 10 Hz grid) |
| `success` | always 1 (pre-filtered) | 1 in all 4 sessions | filtering on webcam is done by `clean_frames` |
| confidence | median 0.98 (OpenFace cap), 1st pct 0.82 | 0.98 constant (cap) | cap is normal, not a bug |
| duplicate consecutive rows | 0.1% | 0.2–1.7% | negligible |
| camera intrinsics | not recorded (OpenFace defaults presumed) | OpenFace defaults | unverifiable for DASD |
| resolution / camera | unknown | unknown to the pipeline (not stored) | unverifiable |
**Semantics.** `gaze_angle_x/y` and `pose_R*` are the same OpenFace outputs (radians). In DASD, `gaze_angle_x` is ≈ head yaw: r(gaze_x, pose_Ry) = −0.965 over frames, per-child median −0.97 (slope −0.755); r(gaze_y, pose_Rx) = 0.72 (slope 0.42). In the webcam sessions r(gaze_x, pose_Ry) is only −0.05…−0.58 and r(gaze_y, pose_Rx) 0.40…0.93: the webcam people move their eyes rather than their head. (`gaze_vs_head_pose.png`.) So the coordinate convention is the same, but what dominates the variable differs.

## 3. Between-subject / camera or something else?
Evidence (per-session mean and std vs DASD per-child ranges; `per_session_mean_vs_std.png`):
- **Means** mostly lie inside the DASD per-child range (gaze-x 4/4, head-yaw 4/4, head-roll 4/4); gaze-y means sit at the 0–11th percentile and head-pitch 2–33rd → a camera-height/pitch offset, not a different coordinate system.
- **Stds** of gaze-x, head-yaw, head-roll are outside the DASD range in 4/4 sessions → the people are very still.
- **Eye-in-head residual** (gaze minus the head-explained part): webcam std 0.022–0.032 (x), 0.020–0.073 (y) vs DASD child percentiles 0/5/50/95/100 = 0.022/0.039/0.082/0.138/0.178 (x): the *eye* component is at the low end of DASD but not outside it. The gap is therefore mostly **head movement** (20–35× smaller yaw spread), i.e. people are still and constrained by the task — not an OpenFace frame mismatch, and not caused by my preprocessing (velocity/windowing are identical code for both).
- Recording resolution/camera differences cannot be tested (not stored for DASD).

## 4. Feature extraction consistency
`gaze_vel = diff(gaze_angle on the 10 Hz grid)·10 [rad/s]`, timestamps in seconds in both sets; grid = linear interpolation of cleaned frames (holes > 0.25 s), no smoothing. Median |velocity| at raw frame rate vs 10 Hz: DASD 0.275 → 0.196 rad/s; webcam 0.06–0.24 → 0.04–0.11. The 10 Hz point-sampling lowers speed by a similar ~30–40% in both. Velocity is **not** a cause of the mismatch (and the selected model no longer uses it). Webcam velocity spread is below the DASD range in 3/4 sessions simply because they move less.

## 5. Feature ablation (dev CV, 3 repeats × 5-fold participant-level, 55 children; test never loaded)
| model | AUC | sens | spec |
|---|---|---|---|
| A gaze only | 0.910 | 0.89 | 0.76 |
| B gaze + velocity | 0.905 | 0.96 | 0.73 |
| C gaze + head pose | 0.936 | 0.95 | 0.76 |
| D all 7 | 0.951 | 0.95 | 0.75 |
| E head pose only | 0.919 | 0.93 | 0.68 |
| F eye-in-head only (gaze minus head part, + vel) | 0.789 | 0.79 | 0.59 |
Fold sd is 0.08–0.17, repeat-to-repeat sd ≈ 0.02–0.04: differences between A–E are **not** statistically distinguishable. What is clear: head pose alone (E) ≈ everything; eye-in-head alone (F) is much weaker.

## 6/7. Normalization / absolute information (same protocol)
| representation | AUC | spec | webcam P(ASD) (4 still adults; behaviour only) |
|---|---|---|---|
| D absolute | 0.951 | 0.75 | 0.98 0.98 0.97 0.54 |
| D session-centred | 0.934 | 0.84 | 0.04 0.03 0.09 0.03 |
| G eye-in-head+head abs / centred | 0.938 / 0.904 | 0.73 / 0.80 | 0.99… / 0.07… |
| F eye-in-head abs / centred | 0.789 / 0.784 | | 0.99… / 0.16–0.44 |
Absolute information carries **no detectable CV benefit** (Δ AUC 0.017 ≪ sd) while making the output depend on camera placement. Session-centring is applied identically in training and inference (`PreprocessConfig.center_session`; unit-tested: same movement + different camera offset → identical tensor). Web-cam data were never altered separately.
Attenuation probe (diagnostic only, never used for training; run on the 7-feature session-centred variant): shrinking all motion in DASD ASD children towards their mean gives mean P(ASD) 0.89 → 0.51 (×0.5) → 0.07 (×0.25) → 0.03 (×0.1). **The classifier is essentially a movement-amplitude detector** (mostly head); a still person is scored "typical" regardless of age or diagnosis.

## 8. Task domain
DASD: unknown stimulus, children at home with a parent, durations 7–66 s, camera distance 280–740 mm. NeuroSense: fixed 30 s picture task, adults/children at a laptop. The audit already showed duration (AUC 0.89), frame rate (0.81) and distance differ by class in DASD, so group differences in recording conditions cannot be excluded. What the model learns: movement amplitude of head (E ≈ full model) and, to a lesser extent, of eyes (F). It does **not** learn stimulus-specific viewing; there is no stimulus information to learn from. **Limitation: most of the signal is head-movement amount, which is task/context-sensitive.**

## 9. Webcam sessions
Used only for distribution/behaviour diagnostics. They have no ASD/TD labels and were not used to train, select, or tune anything.

## 10. Simpler models (dev CV, same protocol)
Window-level LR on robust stats (std, range, IQR, mean |v|, p95 |v|): 0.84–0.87; participant-level LR: 0.87 (abs) / 0.87 (motion-only); gradient boosting motion-only 0.89, with absolute 0.95. **The earlier 0.975 "baseline" was one CV seed and is retracted**; over 3 seeds nothing beats the BiLSTM, so the BiLSTM is kept.

## 11. Redesigned validation gate (A pipeline failure · B data quality · C normal variation · D unsafe out-of-domain)
- A/B: OpenFace/schema errors and the recording-quality gate (unchanged).
- C/D (new, per session, runtime and lab): z = (log within-session std − median)/(1.4826·MAD) per position channel against the DASD per-child distribution stored in the checkpoint. `in_domain` max|z| ≤ 3; `marginal` ≤ 6; `out_of_domain` > 6 (probability withheld, status `out_of_domain`). Fusion needs ≥ 10 good lab sessions with ≥ 80% in_domain, a CV AUC ≥ 0.70, and the session itself in_domain.
- Why: compares like with like, interpretable, uses only quantities the model depends on; offsets are not tested because they are removed by centring.
- **False-reject:** 0/55 dev and 0/27 test DASD children flagged (max |z| 2.25 / 2.56) → 95% upper bound ≈ 3.6% on DASD-like data. Unknown for child webcam data.
- **False-pass:** limited sensitivity to moderate shifts: motion ×0.5 → 2/55 flagged, ×0.25 → 22 marginal/0 out, ×0.1 → 54 flagged. The probe above shows the model already misbehaves at ×0.5, so moderate shifts can pass. Thresholds 3/6 were fixed a priori (Gaussian tails); they were **not** tuned on the webcam sessions (one session lands at 5.98, i.e. "marginal" by 0.02 — irrelevant since marginal is also not fusion-eligible).
- Result on the 4 sessions: 3 out_of_domain (z = −7.2, −6.6, −6.1), 1 marginal (−6.0); driver = head-yaw movement, direction "below".

## 12. More webcam sessions
Not collected by me (no webcam). Needed: 10–20 sessions **of children** (the target population) varying camera, light, distance, position, movement; use Gaze Lab (`/app/gaze-lab`). Adult volunteers will be flagged as out of range by design.

## 13. Decision
**Path B executed, with Path C for fusion.** The representation *was* sensitive to camera placement → redesigned (session-centred), retrained (v2), gate redesigned. But the remaining mismatch is population/task/movement scale, which no feature transform fixes honestly. **Gaze does not enter fusion**; it remains an experimental, displayed-only modality until ≥ 10 in-domain child webcam sessions pass the gate — and even then only technical applicability is shown, not accuracy; a webcam-matched, labelled ASD/TD dataset is still required for clinical claims.

## v2 model (gaze + head pose, session-centred; chosen by the dev-CV rule; 5 features)
Dev CV (3×5 folds): AUC 0.924 ± 0.074, acc 0.867, sens 0.887, spec 0.839 ± 0.26. Test (27, second and final use; not used for selection): acc 0.889, precision 0.864, sens 1.000, spec 0.625 (TN 5, FP 3, FN 0, TP 19), F1 0.927, AUC 0.967. v1 (absolute, 7 features) had test AUC 1.000/spec 1.000; v2 is the more honest and robust model, not a better-scoring one. Candidate variants differ by < 0.02 AUC (noise).
Schema `openface-gaze-1.1.0`, model `gaze-openface-dasd-v2`, features `gaze_angle_x, gaze_angle_y, head_pose_x, head_pose_y, head_pose_z` (session-centred, 10 Hz, 6 s windows).
