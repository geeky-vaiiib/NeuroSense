import pytest
import numpy as np
import joblib
import os
from backend.ml.preprocessor import preprocess_for_inference

MODEL_DIR = os.path.join("backend", "ml")

def test_feature_order_regression():
    categories = ["adult", "child", "toddler"]
    
    for cat in categories:
        model_path = os.path.join(MODEL_DIR, f"model_{cat}.pkl")
        encoders_path = os.path.join(MODEL_DIR, f"encoders_{cat}.pkl")
        
        if not os.path.exists(model_path) or not os.path.exists(encoders_path):
            pytest.skip(f"Missing models for category {cat}. Skipping test.")
            
        model = joblib.load(model_path)
        encoders = joblib.load(encoders_path)
        
        demo = {
            "age": 4, # 4 years old (48 months for toddler)
            "gender": "Male",
            "jaundice": "Yes",
            "familyAsd": "No",
            "ethnicity": "White-European"
        }
        
        answers = {
            "A1": "Definitely agree",
            "A2": "Slightly disagree",
            "A3": "Definitely disagree",
            "A4": "Slightly agree",
            "A5": "Definitely agree",
            "A6": "Definitely agree",
            "A7": "Definitely agree",
            "A8": "Definitely agree",
            "A9": "Slightly disagree",
            "A10": "Definitely agree"
        }
        
        # 1. Use preprocessor
        X_preproc = preprocess_for_inference(demo, answers, encoders=encoders, category=cat)
        prob_preproc = model.predict_proba(X_preproc)[0, 1]
        
        # 2. Manual construction exactly mimicking train_model.py logic
        
        # Same encoding logic for AQ10
        if cat == "toddler":
            # For toddler, A10 agree=1, others disagree=1
            aq_scores = []
            for i in range(1, 11):
                raw = answers[f"A{i}"]
                is_agree = 1 if raw in ["Definitely agree", "Slightly agree"] else 0
                if i == 10:
                    aq_scores.append(is_agree)
                else:
                    aq_scores.append(1 - is_agree)
        else:
            # For adult/child, A1, A7, A8, A10 agree=1, others disagree=1
            aq_scores = []
            trait_ids = {1, 7, 8, 10}
            for i in range(1, 11):
                raw = answers[f"A{i}"]
                is_agree = 1 if raw in ["Definitely agree", "Slightly agree"] else 0
                if i in trait_ids:
                    aq_scores.append(is_agree)
                else:
                    aq_scores.append(1 - is_agree)
                    
        # Age
        age = 48 if cat == "toddler" else 4
        
        # Gender
        if cat == "toddler":
            gender = 1 # Male
        else:
            gender = 1 # Male
            
        # Jaundice
        jaundice = 1 # Yes
        
        # Family ASD
        family_asd = 0 # No
        
        # Ethnicity
        try:
            ethnicity = int(encoders["ethnicity"].transform(["White-European"])[0])
        except Exception:
            ethnicity = 0
            
        if cat == "toddler":
            X_manual = np.array(aq_scores + [age, gender, jaundice, family_asd, ethnicity], dtype=np.float64).reshape(1, -1)
        else:
            X_manual = np.array(aq_scores + [age, gender, ethnicity, jaundice, family_asd], dtype=np.float64).reshape(1, -1)
            
        prob_manual = model.predict_proba(X_manual)[0, 1]
        
        np.testing.assert_allclose(
            X_preproc, X_manual, 
            err_msg=f"Feature matrices differ for category {cat}"
        )
        assert np.isclose(prob_preproc, prob_manual), f"Predictions differ for {cat}: {prob_preproc} != {prob_manual}"
