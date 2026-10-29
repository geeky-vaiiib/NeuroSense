# Dataset attribution — toddler Q-CHAT model

## Polish Q-CHAT dataset (used to train `toddler-qchat10-polish-v1`)
| | |
|---|---|
| Name / version | *Q-CHAT scores of Polish toddlers with autism spectrum disorders and typically developing controls* — Mendeley Data, **V2** |
| Repository | https://data.mendeley.com/datasets/tmpkt2mfkg/2 (DOI 10.17632/tmpkt2mfkg.2) |
| Authors | Niedźwiecka, A.; Pisula, E.; Domasiewicz, Z. (2020) |
| Licence | **Creative Commons Attribution 4.0 (CC BY 4.0)** — copying, redistribution and adaptation are permitted with attribution, a link to the licence and an indication of changes |
| Local file | `backend/data/external/qchat_polish_v2/QCHAT_dataset2 mendeley.sav` (23,098 bytes), sha256 `7fed516fc4e615f4750d0e44c1eea538bbdcdee989e8c2ff8de719976fa08a41` (verified on every load by `backend/data/qchat_polish.py`) |
| Verified size | **252 children** = 135 ASD + 117 typically-developing controls, ages 18–24 months, 252 unique ids (the web page's "118 TD" does not add up to its own total of 252) |

**Required attribution** — Niedźwiecka, A., Pisula, E., & Domasiewicz, Z. (2020). *Q-CHAT scores of Polish toddlers with autism spectrum disorders and typically developing controls* (Version 2) [Data set]. Mendeley Data. https://doi.org/10.17632/tmpkt2mfkg.2 — licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

**Changes made by NeuroSense** (CC BY 4.0 §3(a)(1)(B)): only the ten Q-CHAT-10 items (Q-CHAT items 1, 2, 5, 6, 9, 10, 15, 17, 19, 25) of the 25 were used; one out-of-range value (11, `qchat4recode`) was treated as missing (not a mapped item); recruitment-source labels were derived from the id prefix for stratification and audit only; rows were split into a development set and a holdout set (`backend/reports/toddler_qchat/participant_split.csv`).

**Provenance of the diagnostic label.** The dataset page describes the ASD group as children with "a community-based diagnosis of autism spectrum disorders" and the others as typically developing. The diagnostic instruments (e.g. ADOS-2, ADI-R, DSM-5 criteria) are **not documented** for this sample, so the label's rigour is unverified. The label is independent of the Q-CHAT answers (not a score cut-off) but it is not shown to be a clinically validated diagnosis.

**Data content.** Item-level, de-identified questionnaire responses with age, sex and a few family variables; no names or contact details. Do not add raw clinical records or any identifying participant information to the repository.

**Redistribution.** CC BY 4.0 allows redistributing the file with the attribution above. The repository includes the file only so the audit and training are reproducible; if the licence page changes, re-check it.

**Limitations that matter for NeuroSense**
* Case-control sample (≈54% ASD): model outputs are not population risk.
* Polish translation completed in Poland; no English-language or NeuroSense-population data.
* Recruitment source is strongly confounded with the label (`bdbp#` ids: 89 controls vs 2 ASD; `FS/#`: 80 ASD vs 12 controls).
* Only 252 children, ages 18–24 months; ASD group 71% male.

## The Q-CHAT-10 instrument (item wording and scoring)
The item wording, response options and the scoring rule (Q1–9: C/D/E score 1; Q10: A/B/C score 1; "3 or above" → consider referral) come from the Autism Research Centre's Q-CHAT-10 form (https://docs.autismresearchcentre.com/tests/Q-CHAT-10.pdf), © SBC/CA/BA/ARC/Cambridge University. The ten-item selection follows Allison, Auyeung & Baron-Cohen (2012), *J Am Acad Child Adolesc Psychiatry* 51(2):202–212; the full Q-CHAT follows Allison et al. (2008), *J Autism Dev Disord* 38:1414–1425.

**Licence caveat:** the ARC licenses its instruments for research and non-commercial use and does not permit adaptation without permission. NeuroSense uses the wording unmodified and shows its own helper sentences separately, but **permission/clearance from the ARC has not been obtained** and is needed before any use beyond research/evaluation.
