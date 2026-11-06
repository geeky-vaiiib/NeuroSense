# Results contract audit

Implementation baseline: main `e0d893285e4c46adaf4f8513dc10e198379e7450`. This phase changes presentation and report assembly, not instrument scoring, trained weights, preprocessing or inclusion rules. No model was retrained. See the commit containing this audit and its Actions run for the final revision.

## Trace and authoritative fields

Validated `ScreeningRequest` answers/age → `routers/screening.py` server scoring (`questionnaire_score.py` or `toddler_service.py`) → optional recording preprocessing and owner-checked gaze job retrieval → modality states → questionnaire-only `combine` → `core/reports.py` technical report + `report_presentation.py` plain presentation → atomic owner/key submission document → owner-scoped `case_detail` → `Results` → `UnifiedReport` and both PDF modes. No result, threshold or class decision is recomputed by React/PDF.

| Displayed field | Authoritative source | Transformation | Consumers | Coverage |
|---|---|---|---|---|
| Questionnaire score / maximum | Saved `questionnaire_basis.total_score/max_score`, copied into report.questionnaire | Backend builds `presentation.score_text` and accessible label; never sums browser answers | Default page, simple PDF, detailed PDF | Plain report tests, generated contract fixtures, PDF tests, all three E2E tracks |
| Threshold | Saved `questionnaire.threshold` | Backend labels the stored number; no current-threshold replacement for history | Both PDFs and page | Historical threshold regression, API/reopen tests |
| Outcome | Saved `questionnaire.meets_threshold` boolean | Backend selects plain wording from the flag, never compares numbers or parses interpretation | Both PDFs and page | Contradictory score/flag regression; absent flag means original outcome retained |
| Meaning / next step | Existing sourced instrument guidance in scoring modules and SCORING_AND_EVIDENCE | Backend conservative wording: seek professional advice; assessment may be helpful above threshold; concerns matter below threshold | Both PDFs and page | True/false/unknown presentation cases; no new research claims |
| Instrument/version/category | Saved questionnaire and case category | Names retained, category passed into read-only presentation | Main instrument, PDF metadata, technical provenance | Adult/child/toddler fixtures and E2E; schema tests |
| Recording status | Saved modality statuses and actual measurement/output presence | Backend groups gaze; speech + speech_emotion; facial + facial_expression into three plain summaries | Recording cards and both PDFs | Skip/failure/partial/measurement-only tests; real speech CNN/tone E2E |
| Gaze rejection | Saved failed-quality/domain state | Outside-range wording and withheld model result; gates unchanged | Recording summary, technical original reason | Synthetic domain-gate tests + presentation regression; physical camera remains NOT RUN |
| Expression/emotion label | Saved output.label, not frontend argmax | Backend “closest … label” wording; excludes autism/internal-feelings interpretation | Page and both PDFs | Contract fixture and actual CNN integration tests; generated-tone E2E |
| Class order/scores | Frozen metadata class order → inference dict → report values | Existing class-score order retained; backend percent formatting once; raw scores retained | Technical disclosure/appendix only | Existing research-model tests; per-row PDF parity assertions |
| Acoustic/image quality units | Saved measurements/quality | Backend `UNITS` plus optional understandable `display_label`; raw names/value/precision preserved | Technical disclosure/appendix only | 180.123456 Hz precision/rounding test; partial fixture |
| Null/unavailable output | Saved state.output and explicit status | Failed/skipped output remains null; measurement availability is independent of classifier availability | Summaries + technical views | Backend null/ownership/retry regressions, PDF absence tests |
| Model identity/hash/schema | Saved model provenance and report rows | Layout only; no checkpoint reload during rendering | Technical disclosure/appendix | Existing artifact checks; UI hides fields; detailed PDF retains values |
| Included/excluded modalities | Backend inclusion allow-list; saved card fields | Questionnaire-only decision; no averaging of tasks | Plain provenance note, technical inclusion reasons | Screening/security contracts, API tests, real-model E2E |
| SHAP/LIME | Authenticated explanation endpoint, actual returned available flag | Requested by explicit button; failures do not affect main result; PDF includes only returned available attributions in detailed mode | Technical disclosure and optional appendix | Browser forced 503 keeps score usable; component verifies no prefetch; PDF available/unavailable tests |
| Date/reference | Original saved report.generated_at/case_id | Display date slice only; PDF print/export time does not replace report time | Footer/reference and both PDFs | Fixture parity, reload/reopen E2E |
| Recorded example | Explicit authenticated example endpoint | Read-only `present(..., example=True)`; source participants remain unpaired; eye-tracker example grouped explicitly, no claimed live acoustic/quality measurement | Persistent example banner, PDF opening and every footer | Example provenance test, cached-model-only regression, browser example export |

## Versioning and historical behavior

New submissions save `research-report-v2` with typed `plain-language-v1` presentation. `report` remains the original persisted object. Retrieval supplies `display_report`: v2 uses its saved presentation; v1 receives a read-only copy with presentation; pre-report records receive a view of their saved scoring basis and modality states. This does not write a migration or rerun scoring/inference. Missing totals, maxima, thresholds and structured outcome flags remain unavailable. A legacy outcome is not inferred from a probability or free-text risk label. Historical synthetic records without reports are explicitly labelled synthetic. Original interpretation is retained in Technical details and the detailed PDF. Additive optional `presentation: null` serialization for v1 is not a database rewrite.

Historical records lacking explicit recording states cannot establish successful analysis: the plain summary says no analysis is available, rather than claiming a new measurement. Original case fields remain in the owner-scoped API response. No legacy model output is promoted into questionnaire screening.

## Confirmed problems corrected

- The default v1 view exposed raw internal fields and eight competing submodule cards. It now has a questionnaire-first hierarchy and three recording groups.
- Explanations were prefetched on every result/reopen. They now require an explicit request; a 503 leaves the saved summary usable.
- The newer PDF path returned before adding the confidentiality footer; both modes now add it on every page.
- Newer and older results used separate UI/formatting paths. They now use one component and an explicit backend historical adapter.
- Cached model-only examples could be described as if live acoustic/quality measurements had occurred. The summary now distinguishes model-only evidence, measurements and classification; the eye-tracker example is explicitly identified.
- Historical original interpretation was initially absent from the new detailed appendix during development; it is now included and tested.
- Default exports had no simple/technical selection. Simple is now the default, with the same plain summary preceding the technical appendix.
- Local lint scanned third-party JavaScript inside `.venv-demo`; it now ignores that environment while checking source/tests.

## Visual and execution scope

Synthetic contract fixtures are generated by `scripts/export_results_qa.py` from the actual backend assembler into `src/test/fixtures/resultsReports.json`. The partial expression label/hash is explicitly a UI fixture; it is not accuracy evidence. The recorded example retains genuine permitted saved outputs from the previous model phase. Routine browser tests use a real disposable backend, questionnaire models and a real speech CNN on a generated six-second tone; media permissions are controlled boundaries. No participant screenshots, recordings or private manifests are committed.

QA checks cover desktop 1440px and mobile 390px, native disclosure keyboard semantics, reference/refresh/history, all three tracks, retry, session recovery, example/live provenance and explanation failure. Both PDF modes are generated for adult, child, toddler, partial, missing/historical and recorded-example cases; every rendered page is visually inspected. Long synthetic names, Latin-1 accents, punctuation, long source text, pagination and confidentiality footers are included. The standard PDF font supports Latin-1; names outside that range are explicitly referred to the original online record instead of corrupted silently. This does not claim complete Unicode typography.

Simple samples fit one A4 page; pathological long content may paginate rather than clip. Technical appendices may span several pages and retain explicit unavailable states. Hardware camera/microphone validation and scientific/clinical validation are outside this presentation phase. No usability study with parents has been conducted; readability was assessed through desktop/mobile visual inspection and task-oriented checks.

Final local checks: 356 backend tests passed, 7 optional-data skips; 109 frontend tests passed; lint/build passed; 7 Chromium E2E passed (22.1s). Both saved-research consistency scripts passed. Browser screenshots cover default/expanded desktop and mobile; all 33 generated PDF pages were inspected, with affected partial-case pages rerendered/reinspected after corrections. See docs/evidence/results_execution.json. Final CI status must be verified against the pushed commit.
