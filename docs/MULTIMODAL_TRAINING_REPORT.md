# Licensed model execution and integration report

Baseline verified: `fa4d192f4573b8b8667bbb8d8a38d8d5fe16a43a`, main, clean; origin https://github.com/geeky-vaiiib/NeuroSense.git. Fetched/pulled fast-forward only. No applicable AGENTS.md found. Presentation slide5 objectives and slide10 four-model/fusion architecture reread; presentation unchanged. Current implementation and prior trainers/audits/contracts inspected before changes. This report advances the target in TARGET_ARCHITECTURE_AND_GAPS.md; its earlier inventory remains a dated baseline.

## Environment and boundaries

Local macOS arm64, 16GiB RAM, 10 CPU cores, Python3.11.14. Separate `/tmp/neurosense-model-training` venv installed with `uv pip sync --require-hashes backend/requirements.lock`; Torch2.6.0, NumPy1.26.4, pandas2.2.3, sklearn1.6.1, existing OpenCV/librosa. CPU2 threads per trainer, no external/paid compute. No new dependency pins or runtime substitution. New compact weights total ~1.3MiB; statistical baselines use safe JSON; Torch loads state dicts with weights_only=True and SHA checks. Shipped OpenFace v3 hash remains `b3899134d927af0013ba68e9c045c41aaf443e3de8cb2a227719b4043300a8d9`; not overwritten, retrained or promoted.

Raw archives, identifiable photos/audio, numerical caches and private split manifests live only in ignored, private `research-data/` / `experiments/`. No participant media, IDs, credentials or identifying screenshots are committed. Versioned model artifacts and aggregate reports are permitted under the source terms; see backend/models/research/LICENSES.md. The research-model directory is separate from existing shipped questionnaire/gaze artifacts.

## Dataset acquisition: terms checked, downloaded, verified

Accessed 2026-11-03 UTC (local session crossed November4). No access control bypass or participant upload. Archive verification reproduced with `backend.data.download_research_data`; per-image hashes checked on facial ingestion. Public metadata/source descriptions are not independent consent/diagnostic adjudication.

| Data/version and authoritative source | Licence/access | Download and integrity | Actual contents/IDs/labels |
|---|---|---|---|
| [Cilia Figshare20113592 v1](https://figshare.com/articles/dataset/20113592), file35980367 | CC BY4.0, direct public download | 146,058,143 bytes; provider MD5 `76b48bb15197a75c9ff9231d4ccb4f58`; SHA256 `a3b9341e48a7f57f3a51dd2bc0074642273ce701c3052a92430ba0bd14e80c66` | 25 experiment CSVs plus59 unique participant metadata rows (29ASD/30TD), ages2.7–12.9. Participant in recording joins exact numeric metadata key; multiple people/trials per experiment. Class/CARS fields, clinical instrument provenance unverified. Eye-tracker pixels/AOI/pupil, not OpenFace angles |
| [V_Expression Mendeley9gr9cn3bbn v1](https://data.mendeley.com/datasets/9gr9cn3bbn/1); [attributed release v1.0](https://github.com/atomashevic/emotion-course-data) | CC BY4.0. Original public file/API requests returned403 (one guessed endpoint404); used user-specified public redistribution, not an access bypass | 103,723,939 bytes; published SHA256 `164eaab6256d36c1f548c2797aefe3b696a373676aa20beecc1a4f3c960699d1`; all889 copy-image SHA256s matched manifest | **127 people/889 images**, not landing-page168/1176; seven intended posed expressions/person. Filename/manifest identity and expression codes; no ASD labels or independent affect ratings. Person-level supplied held-out split. Ages/demographic generalizability undocumented. Course precomputed CLIP scores never used |
| [RAVDESS Zenodo1188976 v1.0.0](https://zenodo.org/records/1188976), audio speech only | **CC BY-NC-SA4.0**, noncommercial research; no commercial use/deployment granted | 208,468,073 bytes; provider MD5 `bc696df654c87fed845eb13823edef8a`; SHA256 `5d208e01632cc3e5242106fa2af3273e6dc5239fb8143131979ac74c4aa40657` | 1,440 WAVs, 24 actor IDs in documented filenames; eight acted-emotion labels, two statements, North American English. Neutral has half the observations of each other class. No ASD/control labels. Speaker split assigned before chunking |

Attribution and modifications are recorded beside artifacts. RAVDESS's page has a generic attribution sentence, but its detailed licence and API explicitly say BY-NC-SA4.0; the stricter explicit licence was followed. No face/voice identity recognition or inferred ASD labels from emotion were used.

## ASD-labelled speech investigation — BLOCKED

No investigated source supplied a suitable unauthenticated, verified ASD/control raw-audio corpus under available authorization. This is a scoped search result, not a claim that no dataset exists.

* [ASDBank access](https://talkbank.org/asd/), [access levels](https://talkbank.org/0share/access.html) and [ground rules](https://talkbank.org/0share/rules.html): registration/access and noncommercial/confidentiality obligations apply. No account was created or access bypassed. [Eigsti](https://talkbank.org/asd/access/English/Eigsti.html) and [Nadig](https://talkbank.org/asd/access/English/Nadig.html) explicitly list media unavailable. Transcripts cannot substitute for audio.
* [NYU–Emerson](https://talkbank.org/asd/access/English/NYU-Emerson.html): current published corpus described as30 autistic children, not a published ASD/control acoustic cohort. Larger anticipated/control recruitment does not establish available matched controls. Access and child/adult speaker segmentation would also need review.
* [Slovak autistic/non-autistic child speech corpus](https://aclanthology.org/2024.lrec-main.1399/): appropriate participant-level ASD/control study, but sharing described for qualified researchers, not an unrestricted direct download. Institutional qualification/access approval and applicable data terms needed.
* [Bridge2AI Pediatric v1](https://physionet.org/content/b2ai-voice-pediatric/1.0.0/): credentialed access, participant/session IDs and derived features; PhysioNet record explicitly lacks raw audio. Raw access via Synapse requires institutional sign-off. No credentials or approval available here.
* [Vaani atypical speech](https://vaani.iisc.ac.in/atypical-speech): source explicitly does not rely on clinical labels; not a verified ASD/control classifier target.

Thus **ASD speech training/integration NOT RUN**. Existing speech-ASD output remains null/model_unavailable. RAVDESS is a separate emotion task. Next dependency: authorized speaker-labelled ASD/control recordings with diagnostic provenance, matched language/age/task/device, licence and consent scope, and an independent evaluation cohort. No notification/contact messages were sent to dataset authors.

## Fixed training and held-out protocol

Protocol written before fits: MODEL_TRAINING_PROTOCOL.md. Seeds20261104, fixed LR C1, CPU2 deterministic Torch, AdamW lr.001/wd.01, batch32, clip1; no tuning against test, no calibration or oversampling. Each module completed a two-epoch train/validation-only smoke with no test evaluation before full training. A smoke ingestion defect (unidentified gaze row token) was corrected by counting/excluding those unlabelled rows; never guessing participant labels. Smoke artifacts remain private and are not shipped.

* Facial: supplied course held-out40 people retained as test; development87 →70train/17validation. Detect/crop/CLAHE/grayscale64 shared with runtime, no no-face centre-crop success. Training-only flip/translation/brightness augmentation; HOG+standardized balanced LR baseline. Compact CNN conv16/32/64, pooled4x4, head128, dropout.3; full45epochs, validation-selected41. No pretrained weights, CLIP features or source test scores used.
* Speech: 24actors split16train/4validation/4test, sex-balanced, then audio segmentation. 16kHz mono, fixed30dB trim and <=4s padded chunks, 64-bin log-Mel; acoustic20-MFCC mean/SD+ZCR/RMS/centroid LR baseline. Same compact CNN; training-only time mask, max35epochs/patience10, stopped26/selected16. 960train recordings →961chunks; validation/test240recordings each. All chunks from a speaker stay grouped; recording-mean scores used for metrics. No ASD labels invented.
* Gaze:59metadata IDs assigned stratified participant splits before windows (all files/trials for a person grouped). Unidentified/invalid frames excluded; fixed20Hz4s/2s-stride pixel windows, <=20% long-gap samples; window centring, cap30 evenly spaced windows/person, train-only normalization, participant-equal within-class weights. Two participants had no usable windows →34train/11validation/12test (57total), not quietly moved across splits. BiLSTM hidden24, full early-stopping run12epochs/selected2; this is not the separate two-epoch64-window smoke. Statistics LR, metadata-only LR and independently fitted joint within-window shuffle control use same people/splits. Shuffle selected1/stopped11. Metadata control contains trial duration/valid frames/derived FPS/valid ratio. No ages/IDs/CARS as predictors.

Gaze exclusions:901,786 unidentified-participant frames,301,402 invalid frames,149 invalid/overlong trials,2,058 short trials,4,480 gappy windows; two participants without usable windows. Counts are at different levels and must not be summed as people. No facial/speech files excluded. Exact per-split sample class balances, histories, confusion matrices and recall arrays are in aggregate reports. Gaze positives after exclusion: train16ASD/18TD; validation5/6; test6/6. Facial every split has7 images/person, one/class. Speech test has16neutral and32/class otherwise.

## Actual held-out results

All CNN/LSTM epochs were selected on validation macro-F1. Held-out metrics were calculated after selection, once per fixed arm; no test tuning or subsequent CNN retraining. Fixed baseline JSONs were exported by repeating only their training fit, without new test evaluation/selection. All scores uncalibrated. CIs:1,000 participant/speaker-cluster bootstrap draws conditional on fitted model, not independent frames/windows; limited held-out groups and cohort selection leave substantial unmeasured uncertainty.

| Module/algorithm | Validation macro-F1 | Test accuracy | Balanced accuracy | Macro-F1 | Test N | Accuracy95%CI |
|---|---:|---:|---:|---:|---|---|
| Facial HOG+LR | .6029 | .6000 | .6000 | .5949 | 280images/40people | See JSON |
| Facial CNN | .7389 | **.7071** | **.7071** | **.7067** | 280images/40people | [.6571,.7571] |
| Speech acoustic LR | .4053 | .4417 | .4297 | .4331 | 240clips/4speakers | See JSON |
| Speech log-Mel CNN | .5011 | **.5167** | **.5273** | **.5033** | 240clips/4speakers | [.4958,.5333] |
| Gaze statistics LR | .6333 | .6667 | .6667 | .6571 | 12participants | See JSON |
| Gaze metadata LR | .7179 | .5833 | .5833 | .5556 | same12 | See JSON |
| Gaze BiLSTM | .8167 | **.8333** | **.8333** | **.8333** | same12 | [.5833,1.0000] |
| Gaze shuffled BiLSTM | .8167 | .8333 | .8333 | .8333 | same12 | See JSON |

Binary BiLSTM sensitivity/specificity .8333/.8333; AUC .8056. Confusion [[5,1],[1,5]]. The identical shuffled result provides **no support for a necessary temporal-order mechanism**. Small N12, selected data, source/task confounding, unverified diagnostic ascertainment and eye-tracker/webcam mismatch prevent any clinical or population inference. It is not a new external confirmatory cohort. Headline decimal values are rounded only here; JSON retains full values. Speech/facial are multiclass emotion/expression tasks; binary ASD sensitivity/AUC are **not applicable**.

Artifacts:

* `backend/models/research/facial-v1/{weights.pt,baseline.json,metadata.json}`; report `backend/reports/research/facial-v1.json`.
* `backend/models/research/speech-v1/{weights.pt,baseline.json,metadata.json}`; report `backend/reports/research/speech-v1.json`.
* `backend/models/research/gaze-v1/{weights.pt,baseline.json,metadata.json}`; report `backend/reports/research/gaze-v1.json` (**offline**).

Metadata includes class/feature schema order, architecture, weights/source/report SHA256, source archive hash, seed/environment, normalization where learned, selected epoch, split counts and private manifest hash. Private IDs/predictions are not published. Reports identify baseline Git commit plus the exact training source SHA; code was uncommitted at fit time and is committed in this phase, so the baseline SHA alone is not misrepresented as containing this new trainer. The exact trained source is committed as `34cc245e5fbf0ab08eba0ad1493ad765cfc02833` and its file hash matches each report. A later source-archive fix only records null/unavailable Git provenance when `.git` is absent; no fitting, selection or inference recipe changed. Runtime source and weights hashes make the actual implementation inspectable.

## Integration and verification boundaries

Two **separate** states: `facial_expression` and `speech_emotion`. Adult technical flows only; caller must satisfy existing face-detection/audio-duration/measurement stage. Child/toddler paths do not run these classifiers and return an explicit restricted/unavailable state if recordings submitted. Source facial ages are undocumented; the adult restriction does not establish age suitability. Original facial/speech ASD states remain unavailable, acoustic/quality measurements remain separate. Model errors/missing/corrupt/incompatible artifacts return null/status/logs, never fabricated output. New class scores are not calibrated confidence, autism risk or measurements of internal feelings. Checkpoint load is not clinical validation.

Saved states include actual label, all class scores, schema/version/hash/licence; case reopen retains them without rerunning inference. Results/PDF use stored values, show research labels and uncalibrated scores, retain nulls, and never recompute screening. The original deterministic server score, scoring provenance, auth/ownership/history/idempotency and questionnaire-only combination rule remain. No fusion on falsely joined datasets. Existing OpenFace webcam gates and checkpoint unchanged; incompatible eye-tracker candidate not registered in webcam runtime. No gaze/app compatibility claimed merely because it is an LSTM.

Post-selection runtime smoke: actual licensed held-out face through local HTTP TestClient → persisted/reopened case matched output; direct frozen emotion inference on an actual held-out RAVDESS clip succeeded. RAVDESS clips are shorter than the existing five-second HTTP measurement minimum, so the source clip was correctly withheld at that stage. The gate was **not weakened**. A separate explicitly generated six-second engineering tone exercises API/browser emotion persistence; not real speech/hardware or emotion-accuracy validation. No physical camera/mic test was performed. Aggregate evidence: docs/evidence/research_application_smoke.json; private case/source data remain ignored.

PDF generated from saved numeric values only and rendered with Poppler; no source face images embedded. Inspection exposed a missing measurement projection; schema/store now preserve speech/facial measurements. Full regression also caught an integration variable shadowing the idempotency key, corrected without changing the contract; failed initial run is recorded rather than hidden. Browser assertion initially compared DOM text with layout-dependent innerText; now compares saved class-score rows. Final commands/results are appended after checks.

## Reproduction (noncommercial, local only)

```sh
python3.11 -m venv .venv-training
. .venv-training/bin/activate
python -m pip install --require-hashes -r backend/requirements.lock
# Raw data never enter Git. Download only sources whose stated terms cover your use.
python -m backend.data.download_research_data --task gaze
python -m backend.data.download_research_data --task facial
python -m backend.data.download_research_data --task speech
export NUMBA_CACHE_DIR=/tmp/neurosense-training-numba
# Fresh private run/output directories required. Existing runs/artifacts are never overwritten.
python -m backend.data.train_research_modalities --task facial --smoke
python -m backend.data.train_research_modalities --task speech --smoke
python -m backend.data.train_research_modalities --task gaze --smoke
python -m backend.data.train_research_modalities --task facial
python -m backend.data.train_research_modalities --task speech
python -m backend.data.train_research_modalities --task gaze
python -m backend.data.export_research_baselines --task facial
python -m backend.data.export_research_baselines --task speech
python -m backend.data.export_research_baselines --task gaze
```

The shipped v1 artifact directories already exist, so full reproduction refuses to overwrite them. Create a fresh isolated source export without copies of v1 artifacts, leaving originals intact:

```sh
mkdir -p /tmp/neurosense-model-reproduction
git archive HEAD | tar -x -C /tmp/neurosense-model-reproduction \
  --exclude='backend/models/research/facial-v1' \
  --exclude='backend/models/research/speech-v1' \
  --exclude='backend/models/research/gaze-v1'
cd /tmp/neurosense-model-reproduction
# Activate the separate locked training venv, then run download/smoke/full/export commands above.
```

Source exports explicitly report unavailable Git provenance with null commit, plus exact code hash and environment. To reproduce on this checkout, copy the source into an isolated checkout/export excluding `backend/models/research/*-v1`, preserving the originals; run there, keeping resulting data/outputs private. Do not delete originals or force-overwrite v1. First reproduction in a fresh export can use a new version/output location after an explicit version change; never register it automatically. No training/download is part of setup or CI. Current training environment stays separate from the application environment.

## Remaining work

ASD speech corpus authorization/clinical provenance; actual target-population webcam/microphone testing; representative labelled deployment data, fairness/source/task checks and external validation; model-specific faithful attribution for new CNN outputs (no explanation is fabricated now); true paired multimodal cohort and trained/evaluated fusion. NeuroSense is **not complete or clinically validated**. Next concrete research execution: obtain approved ASD/control speech access and plan participant-disjoint language/task-matched development; next technical check: consented adult camera/mic flow using separate research outputs, without changing score or gates.

## Final local verification

Checks used a clean tracked-source export plus intended changes, with no DASD, raw research data, local `.env` or production database. Per-test mongomock/private spools; browser servers use disposable in-memory storage. Training ran separately on the verified licensed local sources.

| Check | Actual result |
|---|---|
| `MONGODB_URI=mongomock://model-check GAZE_WARMUP=0 NUMBA_CACHE_DIR=/tmp/neurosense-numba-ci PYTHONPATH=backend /tmp/neurosense-clean/bin/python -m pytest backend/tests -q -rs` | **333 passed,7 skipped,0 failed**,25.73s; seven optional-DASD tests skipped;934 dependency warnings |
| `PYTHONPATH=backend python scripts/check_research_consistency.py` | PASS; stored toddler artifact/split/prediction consistency only |
| `PYTHONPATH=backend python scripts/check_gaze_consistency.py` | PASS; historical saved arithmetic; raw-DASD check unavailable |
| `npm test` | **96 passed**,13 files; jsdom media-play notices remain |
| `npm run lint`; `npm run build` | PASS; existing >500kB chunk warning |
| `NEUROSENSE_PYTHON=/tmp/neurosense-clean/bin/python NUMBA_CACHE_DIR=/tmp/neurosense-numba-ci npm run test:e2e` | **5 passed**,37.0s; four existing flows plus real shipped emotion model on explicitly generated numeric tone, saved reload/PDF/mobile layout |
| Post-selection runtime parity on licensed data | PASS for detected face and direct speech-emotion inference; short clip correctly withheld at HTTP gate; saved questionnaire remains6/10 |
| PDF visual QA | PASS: two A4 pages rendered with Poppler, no clipping/overlap; model class scores/version/hash and saved image-quality values present, short-speech output unavailable |

Fourteen new backend engineering tests exercise real checkpoint load/inference and controlled detector/audio boundaries, source-split isolation, zip traversal rejection, corruption/null states, ownership, child restriction and saved measurement/output consistency. Two new frontend regressions cover class scores and PDF. These are labelled technical coverage, not diagnostic validation. Initial failing checks (idempotency-key shadowing, missing case measurement projection, whitespace-sensitive browser assertion) were corrected and affected checks rerun; no assertions were deleted or failures hidden. No hardware pass is claimed. Final remote CI status must be verified for the pushed commit; local tests alone do not establish it.
