# Scoring and evidence audit

Reviewed 2026-11-02 on baseline `9cfb9b35de2e6f3ad59909562eddeeed2624afad` and subsequent branch changes. No models retrained. Implementation correctness is separate from research validity.

## Authoritative instrument checks

All sources accessed **2026-11-02**. These are screening/referral instruments, not diagnostic tests.

| Instrument / source | Verified rule | Application scope |
|---|---|---|
| [ARC child AQ-10 form](https://docs.autismresearchcentre.com/tests/AQ10-Child.pdf) | Agree scores items 1,5,7,10; disagree scores the remainder; cutoff **6** | Parent report, 4–11 years, suspected autism without a learning disability |
| [ARC adult AQ-10 form](https://docs.autismresearchcentre.com/tests/AQ10.pdf) | Agree scores 1,7,8,10; disagree scores the remainder; cutoff **6** | Adult self-report without a learning disability; app deliberately restricts to 18+ (120 technical maximum), not a claim that younger adults/adolescents have no suitable instrument |
| [ARC Q-CHAT-10 form](https://docs.autismresearchcentre.com/tests/QCHAT-10.pdf) | Q1–9 score C/D/E; Q10 scores A/B/C; cutoff **3** | Caregiver, 18–24 months |
| [ARC full Q-CHAT](https://docs.autismresearchcentre.com/tests/QCHAT.pdf) | Comparing item wording verifies short-form order maps to full-form 1,2,5,6,9,10,15,17,19,25 | Used to verify the dataset mapping, not to replace short-form scoring |

Child wording matches the displayed ARC items except punctuation/typography. Adult wording is now available in the UI. Backend-owned `aq10_content.json` is exported to `src/data/aq10.config.json`; regression checks detect drift. Q-CHAT-10 likewise exports from `qchat10.py`. Its A–E letters encode printed order, not numbers supplied by the browser. Q1–9 recode A=0…E=4; Q10 reverses to A=4…E=0; points are recode ≥2. The five option labels were checked against the short form. Neutral helper lines are authored by NeuroSense and are not part of the official form; their permission and effect on administration remain unresolved.

Age routing: 18–24 months, 4–11 whole years, adults 18+; gaps under 18 months, over 24 months to under 4 years, and 12–17 years receive an unsupported-age message. UI and API both validate selected track ages. Adult 18+ is a conservative product scope, not a newly inferred instrument cutoff. The learning-disability restriction is stated in instrument scope copy; no suitability/clinical triage assessment is implemented.

## Correction and provenance

The old child/adult cutoff 7 is verified as a **dataset-label convention**, not the ARC referral cutoff. New AQ-10 records use **scoring version 3**, cutoff 6. Totals/encoding/item direction are unchanged. Score 5 is below, 6 is at threshold, 7 is above; no intermediate risk tier is generated. `LABEL_RULE_THRESHOLD` remains 7/7/4 solely for audits of legacy training labels. Supplementary models still model those legacy labels, so they may disagree with the corrected instrument result. No prediction was retrained or relabelled.

Historical version-2 records retain threshold 7 and their original item points, band, and basis. Retrieval, explanation and PDF use stored provenance; no read-time migration/rescoring runs. Old unversioned or synthetic records are marked historical. Q-CHAT-10 already used category-specific version 3 and its score rule is unchanged. New source URLs/access dates accompany AQ-10 scoring; Q-CHAT-10 source is recorded in this audit and its threshold-source field.

Trace: displayed config → canonical string/letter validation → backend reverse coding → item points → sum → instrument threshold → stored interpretation/basis → saved case → Results/score explanation → PDF. Browser never scores a screening. Client totals/user IDs/result fields cannot override the authenticated server record. Other analyses remain outside `combine()`; gaze eligibility is always false even if a technical domain check passes.

## Verified implementation facts

Auth/ownership/CSRF checks, versioned score boundaries, historical-basis retrieval/explanation, artifact loading and idempotency are regression tested. Missing/corrupt/incompatible optional artifacts yield unavailable status, not a score or fabricated explanation. Speech produces acoustic measurements, facial produces detection/quality, and neither has a shipped ASD classifier. No multimodal classifier determines a result. PDF exports stored scores/statuses/model output and identifies missing explanations.

## Reported evaluation results (not independently rerun training)

* Toddler: `backend/reports/toddler_qchat/evaluation_report.md`, evaluation.json and checkpoint metadata report nested development selection, logistic items-only model, participant bootstrap intervals, a source-only AUC near .88, and no demonstrated gain over the official score. The 252-row cohort is case-control (~54% ASD), source-confounded, Polish-language and ages 18–24 months. Outputs cannot estimate population autism probability.
* Training code puts imputation/scaling in fold-specific sklearn pipelines, uses development-only selection/Youden threshold and development OOF recalibration. Participant IDs do not overlap in saved split files. Recalibration and threshold are estimated on the selected model's OOF data, so development calibration estimates are optimistic. The holdout was inspected before recalibration was added and the same protocol rerun; it is not an untouched confirmatory set. ID uniqueness does not prove no duplicate real-world participant or household overlap.
* Gaze: trainers split participants before fitting normalizers, balance windows at participant level, and aggregate window outputs per participant. v3 uses 55-participant repeated development CV; all-82 CV is descriptive. Earlier official-test reuse invalidates an untouched-test claim. Reports give dev AUC ~.896, metadata-only ~.90, duration-only ~.89, shuffled-order ~.934 and donor-swap ~.53. These suggest recording context confounding; they do not establish an autism-specific gaze signal. Duration-matched n=21 and small participant bootstrap intervals cannot rescue deployment validity. No population calibration or independent webcam cohort evidence exists. A passed domain gate tests numerical applicability only.

## Independently reproduced lightweight results

`PYTHONPATH=backend python scripts/check_research_consistency.py` reads the checksum-verified Polish SAV, saved splits, predictions and JSON checkpoint; no training. See `evidence/toddler_consistency.json`:

* dev n=189, holdout n=63, zero saved ID overlap; saved official item totals match all holdout rows.
* Checkpoint vs saved holdout prediction maximum absolute error **1.67e-16**.
* AUC **0.9350913**, official-score AUC **0.9158215**, Brier **0.1032663**.
* Independent 2,000-participant bootstrap percentile AUC interval **[0.86766, 0.98081]**. Sampling uncertainty only; does not account for source confounding, protocol selection or population shift.

Questionnaire CSV label rules are checked against all rows by regression tests. Runtime migration fixture: 11 totals × child/adult, exact probability agreement between old runtime and sklearn 1.6.1 / XGBoost 2.1.4; the latter loads without compatibility warnings. Original artifact hashes/probabilities are in `evidence/questionnaire_runtime.json`. This is a finite technical regression, not comprehensive prediction equivalence or research validation. Original model files are unchanged.

Gaze research metrics were **inspected**, not independently reproduced by training. Existing local DASD-dependent tests check preprocessing/checkpoint consistency where data are present; CI may skip these if licensed raw data are absent. Dataset permission/labels, participant overlap across external sources, source-confounding analyses and clinical adjudication require access/governance evidence beyond saved metrics.

## Unresolved evidence and permissions

[ARC terms](https://www.autismresearchcentre.com/research/tests/) permit specified research uses with attribution and restrict adaptations. [Adult licensing page](https://www.autismresearchcentre.com/tests/autism-spectrum-quotient-10-items-aq-10-adult/) distinguishes nonprofit use from commercial/IT licensing. Confirm applicability and permission for this software, helpers, electronic presentation and any deployment with ARC/rights holder; no clearance is asserted. Dataset CC BY attribution does not confer instrument rights. Ethics/guardian consent, retention/deletion, independently assessed diagnoses and representative external validation remain prerequisites for human-participant research. The repository cannot supply those approvals or establish clinical validity. Speech/facial classifiers need licensed participant-labelled corpora; gaze needs a matched protocol, representative cohort and untouched external holdout. No new classifiers or fusion weights are justified here.

Additional gaze consistency check: `scripts/check_gaze_consistency.py` found 82 local participant records, 55 development / 27 historical test, zero ID overlap, and independently recomputed the mean of ten stored development AUCs as **0.8955108359**, matching deployed metadata. This reproduces arithmetic/split inventory, not the underlying fold predictions or training. The gaze-only deployed representation does not consume head-regression slopes. The separate exploratory residual-gaze experiment fits slopes on all development participants before CV; that variant's CV is not strictly fold-isolated preprocessing. It is not the selected runtime representation and must not be promoted as leakage-safe evidence without re-evaluation. Session centering uses the whole recording: the current pipeline is offline, not causal streaming inference. Final v3 weights and domain-reference statistics are fit on all 82 participants; in-sample domain-gate rejection rates are descriptive.

Explanation audit: the endpoint now runs blocking SHAP/LIME work in a thread pool. LIME explicitly explains positive **legacy score-label** class, uses a fixed local seed, and renders category-correct item labels; child text no longer inherits adult item descriptions. Explanations use the currently loaded supplementary model, not an immutable historical model snapshot; this limitation is disclosed in the API. Kernel SHAP is an approximate stochastic explanation, not an independently reproduced causal claim. Historical scoring explanations always use their saved basis.
