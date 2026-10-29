# NeuroSense — project status (2026-10-29, after the toddler Phase 1 pass)

Status levels (kept separate on purpose): **1 Implemented** · **2 Tested technically** · **3 Evaluated on labelled data (leakage-safe)** · **4 Validated for the intended population (children, webcam/phone, NeuroSense task)**.
**Nothing in NeuroSense is at level 4. It is not clinically validated and must not be used to diagnose or to make care decisions.**

## Component status

| Component | 1 | 2 | 3 | 4 | Notes |
|---|---|---|---|---|---|
| Auth / sessions / ownership | ✔ | ✔ | n/a | n/a | Argon2id, JWT cookie + CSRF header, server-side revocation, owner-scoped queries, throttles |
| **Toddler Q-CHAT-10** official score (server-side, ages 18–24 months) | ✔ | ✔ | n/a (deterministic rule) | ✘ | Item wording/scoring from the ARC form; ten-item mapping verified against the dataset's value labels; ARC permission for use beyond research not obtained |
| **Toddler cohort model** `toddler-qchat10-polish-v1` (logistic, items only) | ✔ | ✔ | ✔ (one Polish cohort, n = 252) | ✘ | Preliminary; holdout AUC 0.935 [0.87, 0.98] (n = 63) but not better than the official score; case-control, label rigour unverified, source-confounded; shown separately, never changes the result |
| Questionnaire **score** (server-side, child AQ-10 / adult AQ-10) | ✔ | ✔ | ✘ | ✘ | Threshold is the rule found in the datasets' labels, not checked against the instrument manual |
| Questionnaire ML model | ✔ | ✔ | ✘ | ✘ | Labels are a threshold on the item total in all datasets → models the scoring rule; explanation-only |
| Eye gaze (OpenFace + BiLSTM v3, v2 frozen) | ✔ | ✔ | weak | ✘ | Experimental, excluded from the result (see evidence below) |
| Speech | measurement only | ✔ | ✘ | ✘ | No classifier; synthetic proxy quarantined; training pipeline exists but needs a participant-labelled corpus |
| Facial | detection only | ✔ | ✘ | ✘ | No classifier; FER-2013 "ASD proxy" trainer quarantined |
| Result contract (backend) | ✔ | ✔ | ✘ | ✘ | Result = questionnaire score vs threshold. No composite probability, no weights |
| Explanations | ✔ | ✔ | n/a | ✘ | Score explanation; SHAP/LIME of the ML model (scoped as such); gaze ablation = sensitivity only |
| Frontend (wizard, results, cases, settings) | ✔ | ✔ (unit + manual) | n/a | ✘ | |
| Deployment / ops | partial | ✘ | n/a | ✘ | No container/CI; OpenFace needs Docker (x86-64 recommended) |
| Ethics / governance | ✘ | ✘ | n/a | ✘ | Disclaimers and consent screen only |

## Toddler Phase 1 (this pass)
- **Instrument:** one definition (`backend/ml/qchat10.py`) for item wording, five option labels per item, official scoring (Q1–9: C/D/E; Q10: A/B/C; ≥ 3), recode and dataset/model mapping; ten items = Q-CHAT items 1, 2, 5, 6, 9, 10, 15, 17, 19, 25. The earlier agree/disagree toddler format and its threshold of 4 (a label rule found in a different dataset) are no longer used for new cases; the "Moderate" band does not exist for toddlers.
- **Data:** Polish Q-CHAT (Mendeley V2): 252 children (135 ASD + 117 controls; the page's "118" is inconsistent); audit, attribution (CC BY 4.0) and a recruitment-source confound documented.
- **Model:** participant-level stratified holdout, nested CV, five model families × two feature configs, one-SE rule, dev-only threshold/recalibration, bootstrap CIs, permutation and source controls. Report: `backend/reports/toddler_qchat/evaluation_report.md`. **Disclosure:** the holdout was viewed once before dev-only recalibration was added and the identical protocol re-run, so it is not a fully untouched test.
- **Service/API:** `ml/toddler_service.py` validates age (18–24) and answers, scores officially, runs the model separately (honest `available: false` when the checkpoint is missing or tampered — sha256-checked), stores both; SHAP (exact, log-odds) for the loaded model; LIME not provided.
- **Frontend:** age-routing start page (`/app/screening`), toddler flow (welcome → age → how to answer → ten questions with official wording, a neutral helper line and item-specific options → review/Change → send), `ToddlerResults` (score + plain-language meaning, separate model section with validation status, other-signal status, saved record, optional SHAP). Toddler cases show "At or above / Below threshold" everywhere instead of risk tiers.
- **Not done / blocked:** ARC permission for the wording; clinical validation; any toddler gaze/speech/facial model (see `backend/data/TODDLER_MODALITY_DATA_REQUIREMENTS.md`).

## Confirmed work in the earlier stabilisation pass (all in the repository)
**Integrity / security**
- Questionnaire scoring is computed only on the server (`ml/questionnaire_score.py`), strictly (all 10 answers present and one of 4 options), per instrument. Client `aq10Score`, risk level, probabilities and user ids are ignored (mismatch → warning). Response, stored case, case API and results page use the same stored score.
- **Real defects fixed:** adult items were scored with the child rule (A5/A8 wrong for adults); missing/unknown answers were silently scored as "disagree"; child age range was 5–17 in the API but 4–11 in the UI; stored categories could be silently reassigned from age on read; risk level was driven by the ML probability; the results page showed the *questionnaire's* score as the "speech risk score"; SHAP/LIME silently returned fabricated values when a model was missing or failed (and child-model SHAP was all-zero because the explainer's background was the instance itself); XAI feature names were mis-ordered for adult/child; child item labels did not match the wording shown; the global 10 MB body limit could reject 30 s recordings (a 35.8 MB test video was refused until the per-route limit was added; a typical 2.5 Mbps recording is ~9–10 MB, right at the limit).
- Auth: lab endpoints restricted to clinicians; registration throttle; https origin requires secure cookie; higher-entropy case ids. Auth core (hashing, JWT claims, revocation, ownership, CSRF, CORS) was audited and found sound.
- Removed fabricated/unsafe things: simulated-data fusion meta-classifier (it was loaded by the old fusion engine), synthetic-proxy speech CNN (unsafe pickle), heuristic speech "clinical flags", brightness-based facial "score", FER-2013 "ASD proxy" trainer, hard-coded "modality confidence %" values, settings toggles that nothing read. Artefacts moved to `backend/models/quarantine/` (not loaded).
- Gaze jobs: persisted results (survive restart), timeout watchdog, per-user/concurrency caps; gaze v2 checkpoint untouched (hash verified), v3 separate.
**Feature work:** central modality-status + result contracts; speech/facial reported as measurement-only with real statuses; ASD-speech training pipeline (participant-level split, validation-only selection, safe JSON checkpoint) that refuses to run without a labelled corpus; truthful Results/Settings/health pages; PDF text corrected.
**The previously failing `test_feature_order_regression`:** not an obsolete test or a feature-order defect. Feature order was right; the adult scoring contract was wrong in production code (and the test encoded adult items correctly but child items wrongly). Fixed the code and made the test hold independent per-category contracts.

## Automated results (executed on 2026-10-29)
| Check | Result |
|---|---|
| `PYTHONPATH=backend pytest backend/tests` | **240 passed, 0 failed** (198 earlier + 42 toddler) |
| `npm test` (vitest) | **65 passed** (6 files; 24 new toddler tests) |
| `npm run lint` (eslint, scoped to project code) | clean |
| `npm run build` | succeeds (existing chunk-size warning only) |
| `pyflakes` on backend sources | no undefined names; 3 benign unused imports left |
| PDF test | verifies the text written (jsPDF mocked); real PDF rendering not checked |

## Browser verification (real app: Vite dev server + real backend with an in-memory database; Claude browser pane)
| # | Check | Outcome |
|---|---|---|
| 1 | Register / login / session persistence | **Passed** (full-page reload kept the session; invalid session redirected to sign-in) |
| 2 | Create a screening (consent, demographics, questionnaire) | **Passed**; UI blocks age 12 for the child form with the same rule as the server |
| 3–4 | Submit; backend computes the score | **Passed**: 10 answers entered in the UI → server total 8/10 (expected 8), band High. Tampered API call (client 10/High/0.99) → server 6, Moderate, warning |
| 5 | Record a real webcam gaze session | **NOT VERIFIED** — the browser pane blocks camera and microphone. The MediaRecorder/upload code was not exercised in a browser |
| 6–7 | OpenFace processing + job polling | **Passed via the live API** (not the browser UI): a 35.8 MB, 30 s synthetic-motion video made from a photograph (not a webcam recording) → 202, stages observed, ~17 s end to end with real OpenFace (Docker, Rosetta), result `gaze-openface-dasd-v3`, domain `marginal`. The UI polling loop is covered only by unit/mocked tests |
| 8, 10 | Correct modality state / results page equals stored values | **Passed**: gaze card showed "Experimental · not used", 900/900 frames, quality 97%, movement statistics; totals matched the API |
| 9 | Save and retrieve the case | **Passed** (history list, results by id) |
| 11 | Experimental/unavailable modalities not in the result | **Passed** (UI "Used for the result" appears once; API `modalities_in_result: ["questionnaire"]`) |
| 12 | Logout and protected routes | **Passed**: after sign-out every protected endpoint returns 401 and protected routes redirect |
| — | Failure path | **Passed**: camera permission denied → clear error with retry/skip; the reason was stored and shown on the result. Also: another user got 404/422 on the first user's gaze job |
| — | Not run in a browser | speech recording, facial capture, Gaze Lab page, PDF download, mobile layout, screen-reader/accessibility audit, other browsers |

## Toddler browser verification (real Vite dev server + real backend with an in-memory database; Claude browser pane; 2026-10-29)
| Check | Outcome |
|---|---|
| Login/registration, start page, age routing | **Passed** (30 months → explanation, no questionnaire opened; 20 months → toddler flow) |
| Age entry | **Passed**: 17 → plain error and blocked; 20/22/23 accepted |
| Instructions, ten questions, Back/Next, missing-answer message, review, "Change" opens the right question | **Passed**; each of the ten questions showed its own five options in printed order (read back from the DOM) |
| Submit → server-computed score | **Passed**: answers hand-scored 4/10 → page showed 4/10 (items +1 on Q1, Q2, Q4, Q9); all-atypical → 10/10; mostly typical → 1/10 |
| Separate model section | **Passed**: similarity 0.64 labelled "Experimental · not clinically validated … not the chance that your child has autism" |
| Gaze / speech / facial do not affect the result | **Passed**: all three "Skipped / Not used for the result"; the score is shown only in the questionnaire card |
| Stored case, refresh, reopen by URL | **Passed** (reload re-rendered the same values; API `GET /cases/{id}` matched: `age_months` 20, score 4, model 0.641) |
| Model unavailable (checkpoint moved aside, backend restarted) | **Passed**: official score shown; "Model result unavailable"; "Model explanation unavailable" |
| Backend down while sending | **Passed**: recoverable error, answers kept, "Try again", no result invented |
| Mobile layout (375 px) of the results header and score | **Looked at**; the rest of the results page at that width was not inspected |
| **Limits** | Camera/microphone are blocked in the pane, so gaze/speech/face capture were not exercised (they are skipped in this track). Many repeated steps (selecting ten answers, typing the age) were driven with scripted DOM clicks rather than individual pointer clicks; real clicks were used for registration, routing, the welcome/age/instruction/first-question steps and the final send. No screen-reader or keyboard-only session was run (keyboard behaviour is unit-tested only); only one browser engine. |

## Model evaluation evidence
- **Toddler Q-CHAT-10 (Polish cohort, 252 children):** dev nested-CV AUC 0.94 (logistic), holdout (n = 63) AUC 0.935 [0.87, 0.98], sensitivity 0.88 [0.76, 0.97], specificity 0.79 [0.64, 0.94]. The official Q-CHAT-10 points reach AUC 0.916 on the same children; the model is **not demonstrably better**. Recruitment source alone gives AUC 0.88. Case-control (54% ASD) → outputs are not risks. No external validation.
- **Questionnaire:** in all three datasets a threshold on the item total reproduces the label for 100% of rows (adult/child ≥ 7, toddler ≥ 4); item-free demographic models reach AUC 0.58–0.70. No independent clinical label exists here → **no clinical claim is possible**.
- **Gaze (DASD, 82 children, ADOS-2 labels, unknown stimulus):** v3 development CV AUC 0.896 (95% CI 0.76–0.99; participant-level, 10×5-fold, 55 children); all-82 CV 0.932 (descriptive). Recording-metadata-only controls reach 0.90; duration alone 0.89; shuffling temporal order does not hurt (0.934); donor-swap control 0.53 (no leakage through length/holes); duration-matched subset AUC 0.95 (n = 21). Verdict: not shown to learn ASD-related gaze behaviour beyond collection context. Webcam adult sessions fall 6–7 robust SDs below the training head-movement range. No untouched test set exists.
- **Speech / facial:** no trained or evaluated classifier.

## Known issues
- Questionnaire pickles were saved with scikit-learn 1.6.1 while `requirements.txt` pins 1.5.2 (warning at load; models load and explain correctly in tests/E2E) — re-export needed.
- The one-point-below-threshold "Moderate" band and the `≥ 7 / ≥ 4` thresholds are the repository's conventions, not instrument-manual cut-offs.
- Clinician notes on the results page live in browser storage only (labelled as such).
- In-process throttles reset on restart and are per worker; gaze jobs also run in-process threads.
- Historical toddler cases created with the old agree/disagree format stay readable but are not re-scored or explained.
- The "Download PDF" button is disabled for toddler cases (the PDF template is not written for Q-CHAT-10).
- The Q-CHAT-10 wording is © ARC; permission for use outside research has not been obtained.
- OpenFace under emulation on Apple silicon is slow to start; production should use a Linux x86-64 host.

## Data and ethics limitations
DASD is an at-home video dataset of young children (82; recording length, frame rate and camera distance differ by class); no consent, age or ADOS metadata is available to this project; the webcam sessions so far are adults. Any use with children needs ethics approval, consent and a retention/deletion policy (the app deletes uploaded video after processing and stores only derived numbers).

## Remaining work (blocked work and why)
0. **Toddler:** ARC clearance; an independent English-language/NeuroSense-population evaluation with clinician-assessed labels; a toddler PDF template; keyboard/screen-reader audit.
1. **Clinical validity of the questionnaire module:** needs independently diagnosed labels (not derived from the items) and participant-level evaluation — blocked on data.
2. **Speech and facial classifiers:** need participant-labelled, deployment-representative corpora with licences — none available here (`train_speech_asd.py` is ready for one).
3. **Gaze:** ≥ 10 in-range child webcam sessions, a matched-protocol labelled evaluation with an untouched test split, and a leakage audit that beats the metadata controls — blocked on data and ethics approval.
4. **Any multi-modality combination rule:** cannot be justified until at least two modalities are validated; `combine()` refuses to guess one.
5. Engineering: container/CI, browser end-to-end automation (including a real webcam run), re-export of the questionnaire models, shared throttling store, clinician-side server-stored notes if wanted.
