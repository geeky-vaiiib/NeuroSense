# Toddler multimodal data requirements (gaze, speech, facial)

**Current status.** In the toddler (18–24 month) track only the Q-CHAT-10 questionnaire is used. Gaze, speech and facial analysis are **not** part of the toddler
flow, are **not** fused, and none of them has a model validated for this population. This document lists what would be needed to change that. It is a plan,
not a claim that any of it exists.

## Principles that apply to every modality
* **The unit of evaluation is the child (and the study site), not the frame, window, utterance or recording.** Many frames from one child are one participant.
  Split, cross-validate and bootstrap at participant level; keep repeat sessions of a child on one side of every split.
* **Independent labels.** The ASD / typically-developing label must come from a source independent of the model's input (clinician assessment such as ADOS-2 / ADI-R /
  DSM-5 criteria, recorded with the date and the assessor), not from a questionnaire cut-off or from the recruitment channel. Record provenance per child.
* **No fixed universal sample size.** The number of children needed depends on the effect size, the target sensitivity/specificity, the prevalence of the intended
  population and the precision wanted. Plan it from a pre-specified primary metric and a confidence-interval width (e.g. "sensitivity CI no wider than ±X at the
  planned specificity"), using pilot data, and report that calculation. Counts of frames or hours of video are not a substitute.
* **Independent evaluation cohort.** A cohort (ideally another site/clinic, recorded later) never used for feature design, model choice or thresholds. Case-control
  development data are fine for building a model but cannot give population risk; the final evaluation needs a consecutive or screening-population cohort with a realistic ASD prevalence.
* **Ethics and consent.** Ethics approval (IRB/REC) before collection; written informed parental consent that names video/audio/face data, retention, sharing and
  withdrawal; data-protection assessment (GDPR/HIPAA as applicable); no public release of identifiable recordings; secure storage and de-identified identifiers.
* **Confounds to measure and report:** recruitment site, device, room, lighting, operator, language, sex, age in months, developmental level, medication, co-occurring conditions.
* **Pre-registration of the analysis** (features, model family, selection rule, threshold rule, primary metric) before the evaluation cohort is unblinded.

## Gaze
**Where we are.** The existing gaze model was trained on the DASD dataset with OpenFace-derived features. A webcam domain-validation of that pipeline against
NeuroSense webcam recordings **did not pass**; the model is kept as an experimental, clearly-labelled research output and is excluded from every result. Nothing shows it
is valid for toddlers or for NeuroSense's capture conditions (verify the age range and recording setup of the training data before any claim).

**Needed.**
* *Recordings:* toddler face video during a fixed, documented stimulus protocol (stimulus content, duration, order, viewing distance, the child's seat/parent-lap arrangement). Social vs non-social
  stimuli need a pre-specified analysis plan.
* *Camera:* the camera type that will be used in deployment (webcam/tablet), with minimum resolution and a stable frame rate (record the nominal and achieved rates), fixed exposure where possible; log device and OS.
* *Feature extraction:* OpenFace (or successor) version pinned; gaze angle, head pose, landmark confidence and success flags exported per frame; the same extraction code for training and deployment.
* *Quality:* per-recording tracking success, fraction of frames with the face found, longest continuous tracked span, head-motion range; pre-specified exclusion rules, with the number excluded reported per group (excluding more ASD children is a bias).
* *Identifiers/sessions:* a stable participant id; session id, visit date, repeat sessions flagged; no participant in more than one split.
* *Cohorts:* development cohort (labelled, both classes, matched on age/sex where feasible) and a separate independent evaluation cohort recorded on the deployment hardware.
* *Ethics:* approval and parental consent covering facial video.
* *Validation of the domain gap:* collect a small paired set recorded with the deployment camera and compare feature distributions to the training data before any model is reused.

## Speech
**Where we are.** The speech module performs acoustic measurement only (no ASD classifier is loaded). Earlier proxy/synthetic classifiers were quarantined in `backend/models/quarantine/`. An emotion-recognition or unrelated speech model must not be substituted for an ASD-specific one.

**Needed.**
* *Recordings:* child speech/vocalisation recorded in a standardised elicitation setting (parent–child play or structured tasks), with a documented prompt script; the language(s) and dialects stated.
* *Labels:* independent ASD/TD labels as above, plus language-development measures (e.g. a standard vocabulary/communication inventory), because language delay is a major confounder at 18–24 months.
* *Matching:* age in months, sex, language exposure, hearing screen status; analyses stratified or adjusted for these.
* *Environment/audio quality:* microphone model and distance, sampling rate (≥16 kHz, report the actual), room noise level, SNR estimate per recording, clipping; background voices of the parent are expected and must be handled (diarisation/segmentation) and documented.
* *Segments and metadata:* utterance/vocalisation segments with start/end times, speaker (child vs adult) labels with an inter-annotator agreement estimate, and recording-level metadata. Toddlers who are pre-verbal need a vocalisation-based approach rather than word-based features.
* *Feature extraction and models:* pre-specified candidates, e.g. prosodic/acoustic functionals (openSMILE-type), pretrained speech embeddings, simple linear/tree models first; compared by participant-level nested cross-validation.
* *Speaker-level separation:* every recording of a child, including repeat visits and siblings, stays in one split.
* *Independent evaluation:* separate site/cohort, deployment microphone.

## Facial
**Where we are.** The facial module currently does face detection only (and reports it as such). Face detection and emotion recognition are not ASD classifiers and must not be presented as one. Earlier FER-2013 "ASD proxy" code is quarantined.

**Needed.**
* *Data:* child face images or video with consent for this use, captured with deployment-like devices, with age in months and a documented capture protocol (pose, expression elicitation, distance).
* *Labels:* independent diagnostic labels as above; if expression annotations are used (e.g. facial action units or emotion categories), annotated by trained raters with agreement statistics, and treated as intermediate measurements, not diagnoses.
* *Variation:* skin tone, lighting, camera, accessories, age and sex must be represented and evaluated by subgroup, including error rates per subgroup; face-analysis models are known to perform unevenly across demographic groups.
* *Splitting:* participant-level (all images/frames of a child on one side); site-level hold-out for the final test.
* *Privacy and licence:* explicit consent for face data, retention limits, no re-identification risk in shared artefacts, licence terms for any third-party dataset that is checked **before** training; prefer storing derived features over raw images.
* *Evaluation approach:* pre-specified primary metric, participant-level CIs, calibration, comparison to a questionnaire-only baseline to show added value, and a documented decision not to deploy if no added value is demonstrated.

## Fusion
A multimodal result is only justified after each modality has been validated independently on the intended population and a pre-specified fusion method is shown, on a held-out cohort, to improve on the questionnaire alone. Until then the questionnaire score alone is the result.
