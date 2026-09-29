"""Train a meta-classifier for multimodal fusion."""

import pickle
import random
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score

def simulate_fusion_data(num_samples=200):
    """Simulate probabilities for Questionnaire, Gaze, Speech, Facial."""
    np.random.seed(42)
    random.seed(42)
    
    # Features: [q_prob, gaze_prob, speech_prob, facial_prob]
    X = []
    y = []
    
    for _ in range(num_samples):
        is_asd = random.choice([0, 1])
        y.append(is_asd)
        
        if is_asd:
            # higher probabilities
            q = np.random.normal(0.8, 0.1)
            g = np.random.normal(0.75, 0.15)
            s = np.random.normal(0.7, 0.2)
            f = np.random.normal(0.65, 0.2)
        else:
            # lower probabilities
            q = np.random.normal(0.2, 0.1)
            g = np.random.normal(0.25, 0.15)
            s = np.random.normal(0.3, 0.2)
            f = np.random.normal(0.35, 0.2)
            
        X.append([
            np.clip(q, 0.0, 1.0),
            np.clip(g, 0.0, 1.0),
            np.clip(s, 0.0, 1.0),
            np.clip(f, 0.0, 1.0),
        ])
        
    return np.array(X), np.array(y)

def train_fusion_model():
    print("Generating simulated fusion dataset...")
    X, y = simulate_fusion_data(500)
    
    split = int(0.8 * len(X))
    X_train, y_train = X[:split], y[:split]
    X_val, y_val = X[split:], y[split:]
    
    print("Training Logistic Regression meta-classifier...")
    # Add class weights or L2 regularization if necessary
    model = LogisticRegression(random_state=42, class_weight='balanced')
    model.fit(X_train, y_train)
    
    preds = model.predict(X_val)
    probs = model.predict_proba(X_val)[:, 1]
    
    print("\nValidation Metrics:")
    print(f"Accuracy: {accuracy_score(y_val, preds):.4f}")
    print(f"ROC-AUC: {roc_auc_score(y_val, probs):.4f}")
    print("\nLearned Weights:")
    features = ["Questionnaire", "Gaze", "Speech", "Facial"]
    for name, weight in zip(features, model.coef_[0]):
        print(f"  {name}: {weight:.4f}")
    print(f"  Intercept: {model.intercept_[0]:.4f}")
    
    out_dir = Path(__file__).resolve().parent.parent / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "fusion_meta.pkl"
    
    with open(out_path, "wb") as f:
        pickle.dump(model, f)
        
    print(f"\nSaved fusion meta-classifier to {out_path}")

if __name__ == "__main__":
    train_fusion_model()
