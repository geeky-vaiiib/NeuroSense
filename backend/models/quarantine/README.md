# Quarantined artefacts - NOT loaded by the application

| file | why it is quarantined |
|---|---|
| `fusion_meta_SIMULATED_DATA.pkl`, `train_fusion_SIMULATED_DATA.py` | The "fusion meta-classifier" was trained on *simulated* per-modality probabilities drawn from Gaussians (`simulate_fusion_data`). It carries no information about real children, so the fusion engine no longer loads any fusion model. |
| `speech_cnn_SYNTHETIC_PROXY.pt` (+ metadata) | A 1D-CNN trained on MFCC arrays with planted statistical differences (`dataset_identifier: SYNTHETIC_PROXY`). It is a pipeline test fixture, not an ASD classifier, and is a whole-model pickle (`torch.load(weights_only=False)`), which is unsafe to deserialise. |

They are kept only for provenance. Do not move them back. See `backend/data/train_speech_asd.py` for the speech
training pipeline that requires a participant-labelled manifest, and `backend/ml/fusion_engine.py` for the fusion contract.
| `train_speech_cnn_SYNTHETIC_PROXY.py`, `train_speech_PROXY.py` | Trainers for the synthetic-proxy speech CNN (planted statistics, no participants). |
| `train_facial_cnn_FER2013_RELABELLED.py`, `train_facial_PROXY.py` | Train an emotion dataset (FER-2013) after relabelling emotion classes as an "ASD proxy". Emotion recognition is a different task from ASD classification, the relabelling has no clinical basis, and facial expression must not be read as evidence of autism. |
