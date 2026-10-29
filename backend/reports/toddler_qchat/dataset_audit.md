# Polish Q-CHAT dataset audit (Mendeley Data V2)

Citation: Niedźwiecka, A., Pisula, E., Domasiewicz, Z. (2020). Q-CHAT scores of Polish toddlers with autism spectrum disorders and typically developing controls. Mendeley Data, V2. doi:10.17632/tmpkt2mfkg.2 (CC BY 4.0)

- File `QCHAT_dataset2 mendeley.sav` sha256 verified. **Rows 252** = ASD 135 + control 117; unique child ids 252; duplicate ids 0; duplicate 25-item patterns 0.
- Count discrepancy: 252 toddlers; 135 ASD and 118 TD (135 + 118 = 253) → the file has 252 rows = 135 ASD + 117 controls; the '118' on the page is inconsistent with its own total of 252.
- Response scale: integers 0-4 per item, higher = more atypical (already direction-recoded by the authors; `*recode` columns). Out-of-range: {'qchat4recode': [{'child_id': 'bdbp0221', 'group': 7.0, 'qchat4recode': 11.0}]} (set to missing; none of the ten mapped items affected). Missing in the ten items: 0.
- Age: {18: 37, 19: 35, 20: 40, 21: 29, 22: 28, 23: 40, 24: 43} months (instrument range 18-24). Sex by group: {'ASD': {1: 96, 2: 39}, 'control': {1: 61, 2: 56}}.
- Mapping verified against the dataset's Polish value labels for all ten items (Q2 label typo noted).
- Official Q-CHAT-10 rule on this data: >=2: sens 0.97 / spec 0.67; >=3: sens 0.91 / spec 0.82; >=4: sens 0.79 / spec 0.91; >=5: sens 0.68 / spec 0.96; AUC 0.937.
- Label provenance: '135 with a community-based diagnosis of autism spectrum disorders (ASD) and ... typically developing toddlers'. Label is independent of the Q-CHAT (not derived from item totals) but its clinical rigor (ADOS-2/ADI-R/DSM-5) is NOT verified from the sources available here.
- Recruitment source × group: {'#': {'control': 14, 'ASD': 50}, 'A#': {'control': 2, 'ASD': 3}, 'FS/#': {'control': 12, 'ASD': 80}, 'bdbp#': {'control': 89, 'ASD': 2}} (source alone would give AUC 0.90).

## Sampling limitations
- case-control design: 53.6% ASD; prevalence in the intended population is far lower, so predicted probabilities are not population risk and PPV would be much lower
- recruitment source almost determines the label (bdbp# ids: 89 controls vs 2 ASD; FS/# ids: 80 ASD vs 12 controls): collection context is confounded with diagnosis
- Polish translation of the Q-CHAT, completed by caregivers in Poland; not validated for English-language or other populations
- ages 18-24 months only; sex imbalance (ASD 71% male, controls 52% male)
- ASD labels described as 'community-based diagnosis'; instruments used are not documented on the dataset page
- sibling_withASD is missing/0 for every control (structural), so it must never be a predictor

## Licence
CC BY 4.0: attribution required (see citation); changes must be indicated (item values outside 0-4 set to missing; ten of 25 items used).