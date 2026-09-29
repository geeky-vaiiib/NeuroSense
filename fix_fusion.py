import re

with open('backend/ml/fusion_engine.py', 'r') as f:
    lines = f.readlines()

new_lines = []
in_gaze = False
in_speech = False
in_facial = False

content = "".join(lines)

# Fix Gaze
content = content.replace('''    if gaze_result is not None:
        raw = gaze_result.get("score")
        gaze_is_trained = bool(gaze_result.get("is_trained_model", False))
        if raw is not None:
            gaze_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="gaze",
                score=gaze_score,
                method=gaze_result.get("method", "rule_based_heuristic"),
                is_trained_model=gaze_is_trained,
                modality_label=gaze_result.get(
                    "modality_label",
                    "Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="gaze",
                score=0.0,
                method=gaze_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=gaze_result.get(
                    "modality_label",
                    "Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
                ),
                available=False,
            ))
''', '''    if gaze_result is not None:
        raw = gaze_result.get("score")
        gaze_is_trained = bool(gaze_result.get("is_trained_model", False))
        if raw is not None:
            gaze_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="gaze",
                score=gaze_score,
                method=gaze_result.get("method", "rule_based_heuristic"),
                is_trained_model=gaze_is_trained,
                modality_label=gaze_result.get(
                    "modality_label",
                    "Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="gaze",
                score=0.0,
                method=gaze_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=gaze_result.get(
                    "modality_label",
                    "Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
                ),
                available=False,
            ))
    else:
        breakdown.append(ModalityComponent(
            modality="gaze",
            score=0.0,
            method="rule_based_heuristic",
            is_trained_model=False,
            modality_label="Gaze Analysis (Research Heuristic — Jones & Klin 2013)",
            available=False,
        ))
''')

# Fix Speech
content = content.replace('''    if speech_result is not None:
        raw = speech_result.get("score")
        speech_is_trained = bool(speech_result.get("is_trained_model", False))
        if raw is not None:
            speech_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="speech",
                score=speech_score,
                method=speech_result.get("method", "rule_based_heuristic"),
                is_trained_model=speech_is_trained,
                modality_label=speech_result.get(
                    "modality_label",
                    "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="speech",
                score=0.0,
                method=speech_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=speech_result.get(
                    "modality_label",
                    "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                ),
                available=False,
            ))
''', '''    if speech_result is not None:
        raw = speech_result.get("score")
        speech_is_trained = bool(speech_result.get("is_trained_model", False))
        if raw is not None:
            speech_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="speech",
                score=speech_score,
                method=speech_result.get("method", "rule_based_heuristic"),
                is_trained_model=speech_is_trained,
                modality_label=speech_result.get(
                    "modality_label",
                    "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="speech",
                score=0.0,
                method=speech_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=speech_result.get(
                    "modality_label",
                    "Speech Analysis (Research Heuristic — Bone et al. 2014)",
                ),
                available=False,
            ))
    else:
        breakdown.append(ModalityComponent(
            modality="speech",
            score=0.0,
            method="rule_based_heuristic",
            is_trained_model=False,
            modality_label="Speech Analysis (Research Heuristic — Bone et al. 2014)",
            available=False,
        ))
''')

# Fix Facial
content = content.replace('''    if facial_result is not None:
        raw = facial_result.get("score")
        facial_is_trained = bool(facial_result.get("is_trained_model", False))
        if raw is not None:
            facial_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="facial",
                score=facial_score,
                method=facial_result.get("method", "rule_based_heuristic"),
                is_trained_model=facial_is_trained,
                modality_label=facial_result.get(
                    "modality_label",
                    "Facial Analysis (Research Heuristic)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="facial",
                score=0.0,
                method=facial_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=facial_result.get(
                    "modality_label",
                    "Facial Analysis (Research Heuristic)",
                ),
                available=False,
            ))
''', '''    if facial_result is not None:
        raw = facial_result.get("score")
        facial_is_trained = bool(facial_result.get("is_trained_model", False))
        if raw is not None:
            facial_score = round(float(raw), 4)
            breakdown.append(ModalityComponent(
                modality="facial",
                score=facial_score,
                method=facial_result.get("method", "rule_based_heuristic"),
                is_trained_model=facial_is_trained,
                modality_label=facial_result.get(
                    "modality_label",
                    "Facial Analysis (Research Heuristic)",
                ),
                available=True,
            ))
        else:
            breakdown.append(ModalityComponent(
                modality="facial",
                score=0.0,
                method=facial_result.get("method", "rule_based_heuristic"),
                is_trained_model=False,
                modality_label=facial_result.get(
                    "modality_label",
                    "Facial Analysis (Research Heuristic)",
                ),
                available=False,
            ))
    else:
        breakdown.append(ModalityComponent(
            modality="facial",
            score=0.0,
            method="rule_based_heuristic",
            is_trained_model=False,
            modality_label="Facial Analysis (Research Heuristic)",
            available=False,
        ))
''')

with open('backend/ml/fusion_engine.py', 'w') as f:
    f.write(content)

