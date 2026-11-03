# Gaze development comparison protocol

Protocol version: `gaze-dev-comparison-1`, specified 2026-11-03 against baseline main `6fdf5c6800d90cbfe878b0f23e51e37644869d93`. Executable: `python -m backend.data.evaluate_gaze_development`. This is a new **exploratory development** comparison, not a fresh confirmatory evaluation. Existing DASD development and test data have already influenced representation/model choices; v3 weights were fitted to all82. Changing CV seeds does not restore independence from those decisions.

## Question and acceptance criteria

Does the v3 input/architecture offer useful participant-level discrimination beyond an unordered angular-distribution baseline and recording context, and is any advantage dependent on within-window temporal order? No advantage is assumed. The output is an experimental association with the dataset's recorded labels, not a diagnosis or population autism probability. Angular spread does not identify screen position, eye contact, fixation, scanpaths or attention to a known stimulus. No eye-tracker/stimulus calibration exists in this webcam/OpenFace pipeline.

Engineering acceptance: no participant/window crosses an outer split; only training participants contribute to any learned normalization, scaling, domain reference or classifier fit; no shipped artifact is loaded for scoring or overwritten; no raw historical-test CSV is read; deterministic controls preserve grouping/distribution as intended; every participant has exactly one OOF score per repeat/arm; invalid/incomplete predictions fail; domain-withheld output is null; input/config/version provenance is retained; absent data/permission yields an explicit blocked report.

Research interpretation criteria (not automatic deployment gates): report paired BiLSTM-minus-statistics and BiLSTM-minus-metadata AUC intervals, all control outcomes, exclusion/coverage imbalance and resource cost. An interval including zero does not establish superiority; an interval above zero still does not resolve unmeasured source/device/task confounding. Time-shuffle survival limits claims about order dependence. Poor label-permutation behavior requires investigation before interpretation. No clinical acceptance threshold is invented. Confirmatory evidence requires a newly recruited/approved independent matched cohort and a prospectively frozen analysis plan; this development run cannot supply it.

## Cohort and preprocessing

* Discover DASD folder/participant-key inventory and verify counts (82 =57 ASD/25 TD), unique keys and official train/test key separation. Load and hash **only official train (55) CSV contents**. Discovery of historical test filenames/counts is allowed; their contents are never read by this harness. It intentionally does not call `optional_recordings()`, which validates every CSV and would read historical-test contents.
* Source says one file per child. This is the grouping key assumption, not independent proof of identity, sibling independence or ADOS-2 assessment. Consent/licence scope must cover this reuse; `--data-permission-reference` records the operator's auditable reference and does not create permission.
* Use the existing v3 two-channel config: session-centred gaze x/y, 10Hz, six-second windows, one-second stride, existing interpolation/cleaning rules. Head channels remain necessary for domain checks. Per-record centring/interpolation are fixed transformations on that recording, not fitted across people; no other participant enters them. Fixed head slopes in the config are unused by these two model inputs. No data-driven feature selection or preprocessing tuning is performed.
* Apply the unchanged fixed quality gate once before modelling. Log every development recording's quality report privately; aggregate exclusions by recorded class and reason. All primary arms use this same quality-eligible cohort. Verify finite windows/metadata, required domain channels and enough participants per class for the chosen fold count. Reject duplicate raw CSV content within development, not just duplicate IDs. No exclusion based on model score, desired motion or domain status before CV.
* No camera/OpenFace feature extraction is run here. Previously removed failed DASD frames cannot be recovered, and tracking success in this corpus is not the same evidence as new webcam tracking quality.

## Fixed comparisons

Default: participant-stratified **5-fold ×2 repeats**, seeds `20261103 20261104`. Every session/window for a participant remains in that person's fold. Controls use the exact same fold membership. No holdout is selected or assessed, no hyperparameter search, no early stopping, and no candidate selection/export occur. The fixed 14-epoch budget comes from the historical v3 development recipe and is not a new independent selection result.

| Arm | Input and fit |
|---|---|
| `statistics_lr` | For each six-second window/channel: SD, p10, median, p90, IQR; median each statistic over windows (10 gaze-distribution features). StandardScaler + balanced logistic regression C=.3, max_iter5000, fitted on training participants only |
| `metadata_lr` | Duration, frame count, derived mean FPS, maximum raw timestamp gap, valid ratio, continuity, tracker confidence and usable-window count; same training-only scaler/LR. A confounding control, never a proposed app model |
| `bilstm` | Fresh initialization of existing v3 architecture: two inputs, bidirectional hidden32, mean+max pooling, dropout.4; AdamW lr.002/wd.01, batch64, gradient clip1, training noise SD.02, fixed14 epochs. Training-only window normalizer; each participant contributes equally within its class. Never use frozen weights trained on evaluation people |
| `bilstm_time_shuffled` | For each participant/window, jointly permute x/y time rows, retaining joint pairs, window membership/count and exact within-window distribution. Refit/evaluate on shuffled training/test windows. Removes within-window order without moving any value across participants; does not destroy slow between-window structure |
| Label permutation | Five seeded permutations per repeat, conditionally shuffling existing participant labels **within each fixed outer-fold block**, preserving fold class counts. Refit statistics LR, metadata LR and BiLSTM on the permuted training targets; assess against the corresponding permuted test targets. No diagnostic labels are invented or saved into source data |

Five permutations are an initial computational control, not a precise permutation significance test (only ten repeat/permutation instances). Do not interpret near-chance or above-chance single control AUC as definitive. More permutations, preregistered decision rules and new independent data are needed before formal claims. Labels remain attached to all windows of the same person. The harness never performs the historical audit's cross-participant donor swap, which could import held-out feature content through a globally constructed donor pool.

## Domain handling and evaluation

For each outer fold, fit the unchanged robust log-SD domain reference on training participants' gaze/head statistics only. Apply existing in/marginal/out thresholds to held-out people. Primary ungated metrics include all quality-eligible participants for common-cohort comparison; each private OOF record also stores domain status and a separate `gated_output`, null for out-of-domain. Marginal status remains allowed, matching current service behavior. Report accepted-subset metrics and class-specific in/marginal/out counts (participant-repeat counts); domain-dependent exclusions can bias accepted-only estimates. These references are separate research objects; the deployed reference/gates are unchanged.

Participant metrics: pooled OOF ROC-AUC per repeat; sensitivity/specificity at the fixed .5 threshold; Brier score labelled **uncalibrated**; repeat-averaged OOF metrics. .5 on class-balanced training is a fixed engineering convention, not an optimized clinical cutoff. No calibration is fitted and no calibration/population-risk claim is made. If later calibration/tuning/feature selection is added, it requires an inner participant-disjoint development procedure; fitting on outer-test predictions would invalidate evaluation.

Uncertainty: 2,000 participant bootstrap samples of repeat-averaged OOF scores, resampling participants identically for paired model differences. One-class bootstrap draws are omitted; an entirely invalid bootstrap fails. These intervals condition on the fitted OOF models/cohort and do not capture full model-selection, retraining, source or external-population uncertainty. Repeat SD/means and raw fold membership/predictions are retained privately; overlapping windows are never treated as independent observations. Permutation controls are summarized separately, not averaged with observed labels.

## Reproduction and privacy

Use the locked Python 3.11.14 environment from RUNTIME.md. CPU training uses one Torch thread, seeded RNG and deterministic algorithms; same-environment repeatability is tested, cross-platform bitwise identity is not promised. No new package is required.

```sh
# No real database, credentials, webcam, application server or production connection needed.
# Use the actual approved reference; do not copy this placeholder as an approval assertion.
python -m backend.data.evaluate_gaze_development \
  --data-root /path/to/permitted/DASD-main \
  --data-permission-reference '<approved-local-research-reference>' \
  --out experiments/gaze-dev-unique-run
```

Optional CLI flags record explicit protocol deviations: `--folds`, `--seeds`, `--epochs`, `--permutations`, `--bootstrap`. Reduced settings are smoke checks, not default-protocol research results. Output directory must be new; existing directories are never overwritten. Repository paths outside ignored `experiments/` are refused. Outputs get private directory/file permissions through umask077. No checkpoints are saved. All existing .pt/.json model-artifact hashes are checked before/after.

`summary.json`: status, commit/dirty flag/harness hash, environment, seeds/protocol, permission reference, aggregate comparisons/exclusions/domain coverage, unchanged artifact hashes. `private_audit.json`: development file hashes/participant keys/quality, exact folds, permutation assignments and OOF/gated predictions. Keep both private until reviewed; **never commit participant-level files, permission documents with personal information, raw recordings or data**. Publish only a reviewed aggregate report under docs/evidence after permission/privacy review. No unsafe pickle cache is used.

Absent data or missing permission reference: exit2, explicit `status: blocked`/reason in a new output directory; no participant contents are read or metrics fabricated. Present corrupt data, invalid grouping/fold/prediction inputs or artifact mutation: fail clearly, never produce success by fallback. The command does not validate a claimed permission document itself; the operator/governance review must do that.

## Execution evidence for this phase

* Presentation/config/audit and local metadata inventory inspected. Historical saved development AUC arithmetic checked separately with `scripts/check_gaze_consistency.py`; not new model evaluation.
* Harness engineering tests use arbitrary binary software groups and numeric fixtures, not generated diagnoses or real participants. They exercise actual tiny CPU BiLSTM training, repeatability, fold/normalizer/scaler/reference isolation, grouping, shuffle invariance, malformed predictions, withheld null output and blocked CLI behavior. Their metrics are not research evidence.
* Local DASD feature CSVs are present. The operator explicitly confirmed that permission for this project's reuse is **unverified**: no verified licence or written permission reference is available. Public accessibility/presence on disk is not authorization. Applicable authoritative reuse terms or written permission specifying activities/restrictions must be established before any further DASD evaluation/retraining; no upload or redistribution is permitted by this phase. New participant-data comparison: **NOT RUN / BLOCKED on permission reference**, not blocked on checkpoint loading or fabricated lack of files. No raw dataset download, new participant-data fit or artifact retraining is reported.
* Real usable-face webcam validation, external-cohort evaluation and scientific/clinical validation remain **NOT RUN**. See GAZE_EXECUTION_REPORT.md and TARGET_ARCHITECTURE_AND_GAPS.md.

## Actual engineering verification

Tests ran in a fresh tracked-file export plus the intended harness/tests, without DASD or local `.env` files, using the verified locked venv and isolated mongomock/spools. Exact tested source fingerprint and aggregate results: `evidence/gaze_harness_execution.json`.

| Command | Observed result |
|---|---|
| `MONGODB_URI=mongomock://target-ci GAZE_WARMUP=0 NUMBA_CACHE_DIR=/tmp/neurosense-numba-ci PYTHONPATH=backend python -m pytest backend/tests -q -rs` | PASS: **319 passed, 7 skipped, 0 failed**, 24.08s; seven optional-DASD skips; 934 dependency warnings |
| `PYTHONPATH=backend python scripts/check_research_consistency.py` | PASS; saved/checkpoint prediction max error 1.67e-16; not new cohort evidence |
| `PYTHONPATH=backend python scripts/check_gaze_consistency.py` | PASS; saved arithmetic checked; raw-data check unavailable |
| `npm test` | PASS: **94 passed**, 13 files; jsdom media-play notices remain |
| `npm run lint`; `npm run build` | PASS; existing >500kB chunk warning remains |
| `NEUROSENSE_PYTHON=/tmp/neurosense-clean/bin/python NUMBA_CACHE_DIR=/tmp/neurosense-numba-ci npm run test:e2e` | PASS: **4 passed**, 33.1s; controlled recording boundaries, not webcam validation |
| Harness CLI with local data present but no permission reference | BLOCKED, exit2; explicit permission reason, no model metrics or participant reads |

The first clean-archive suite found two CLI tests failing because provenance collection required `.git`. The harness now records null/unavailable Git provenance for source archives (retaining source hash/environment); an explicit regression covers this. The final suite above includes **19 new harness engineering tests**, actual tiny numeric-only CPU fits, a complete CLI/real-learner/OOF/export success run with only the data loader replaced, and separately mocked orchestration/loader boundaries. It is not a retraining or validation of shipped models. The v3 checkpoint hash remains `b3899134d927af0013ba68e9c045c41aaf443e3de8cb2a227719b4043300a8d9`.

Push/remote CI acceptance must be checked for the new commit separately; local results alone do not establish it.
