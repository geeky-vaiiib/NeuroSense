#!/usr/bin/env python3
"""
data/train_model.py — Category-aware training for NeuroSense ASD classifier.

Supports dual-category: adult and child.
CRITICAL: Drops the 'result' column to prevent data leakage.

Usage:
  cd backend/
  python -m data.train_model --category adult
  python -m data.train_model --category child
  python -m data.train_model                     # train both

Dataset expectations:
  backend/data/asd_screening_adult.csv    (or legacy asd_screening.csv)
  backend/data/asd_screening_child.csv

Outputs:
  backend/ml/model_adult.pkl     / encoders_adult.pkl     / background_adult.npy
  backend/ml/model_child.pkl     / encoders_child.pkl     / background_child.npy
"""
import argparse

import os
import sys
import warnings
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, roc_auc_score, precision_score, recall_score,
    f1_score, cohen_kappa_score, make_scorer,
)
from sklearn.ensemble import AdaBoostClassifier, GradientBoostingClassifier
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE

try:
    from backend.ml.config import CATEGORY_MODEL_CONFIG
except ImportError:  # pragma: no cover - fallback for backend cwd execution
    from ml.config import CATEGORY_MODEL_CONFIG

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


# ── Feature columns ────────────────────────────────────────────────
AQ_COLS = [f"A{i}_Score" for i in range(1, 11)]
NUMERIC_FEATURES = AQ_COLS + ["age"]
CATEGORICAL_FEATURES = ["gender", "ethnicity", "jaundice", "austism"]  # sic: dataset typo
LEAKAGE_COLUMNS = ["result"]  # THIS MUST BE DROPPED


def load_and_clean(path: str, category: str = "adult") -> pd.DataFrame:
    """Load CSV, drop leakage columns, handle missing values."""
    print(f"\n{'='*60}")
    print(f"  NeuroSense — {category.upper()} Model Training")
    print(f"{'='*60}\n")

    if not os.path.exists(path):
        print(f"ERROR: Dataset not found at {path}")
        print("Please download the ASD Screening Adult dataset and place it as:")
        print(f"  {path}")
        print("\nDataset: https://www.kaggle.com/datasets/andrewmvd/autism-screening-on-adults")
        sys.exit(1)

    df = pd.read_csv(path)
    print(f"[1/8] Loaded dataset: {df.shape[0]} rows × {df.shape[1]} columns")

    # ── Normalise column names ────────────────────────────────────
    df.columns = df.columns.str.strip().str.replace("/", "_").str.replace(" ", "_")

    # ── Identify target column ────────────────────────────────────
    target_col = None
    for candidate in ["Class_ASD", "Class/ASD", "class_asd", "Class"]:
        normalized = candidate.replace("/", "_").replace(" ", "_")
        if normalized in df.columns:
            target_col = normalized
            break

    if target_col is None:
        # Try case-insensitive search
        for col in df.columns:
            if "class" in col.lower() or "asd" in col.lower():
                target_col = col
                break

    if target_col is None:
        print(f"ERROR: Cannot find target column. Available: {list(df.columns)}")
        sys.exit(1)

    # Encode target to binary
    df["target"] = df[target_col].map(
        lambda x: 1 if str(x).strip().upper() in ("YES", "1", "TRUE") else 0
    )
    print(f"       Target column: '{target_col}' → binary 'target'")
    print(f"       Class distribution: {dict(df['target'].value_counts())}")

    # ── DROP LEAKAGE COLUMN ───────────────────────────────────────
    for col in LEAKAGE_COLUMNS:
        if col in df.columns:
            df = df.drop(columns=[col])
            print(f"\n  ⚠  DROPPED '{col}' column — prevents data leakage (it's the sum of A1-A10)")

    # ── Drop rows with too many missing values ─────────────────────
    missing_per_row = df[AQ_COLS + CATEGORICAL_FEATURES].isnull().sum(axis=1)
    before = len(df)
    df = df[missing_per_row <= 2].copy()
    dropped = before - len(df)
    if dropped > 0:
        print(f"       Dropped {dropped} rows with >2 missing feature values")

    # ── Impute numeric ────────────────────────────────────────────
    for col in NUMERIC_FEATURES:
        if col in df.columns and df[col].isnull().any():
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)

    # ── Handle missing categoricals ───────────────────────────────
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            df[col] = df[col].fillna("Unknown").astype(str).str.strip()

    return df


def encode_features(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Label-encode categorical features. Returns (df, encoders_dict)."""
    encoders = {}
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col])
            encoders[col] = le
            print(f"       Encoded '{col}': {len(le.classes_)} classes")

    # Rename 'austism' to 'family_asd' in encoders for frontend clarity
    if "austism" in encoders:
        encoders["family_asd"] = encoders.pop("austism")

    return df, encoders


def build_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Extract X feature matrix and y target vector."""
    feature_cols = []
    for col in AQ_COLS + ["age"] + CATEGORICAL_FEATURES:
        if col in df.columns:
            feature_cols.append(col)

    X = df[feature_cols].values.astype(np.float64)
    y = df["target"].values.astype(np.int32)

    print(f"\n[2/8] Feature matrix: {X.shape[0]} samples × {X.shape[1]} features")
    print(f"       Features: {feature_cols}")

    return X, y


def apply_smote(X_train, y_train):
    """Apply SMOTE to balance the training set."""
    print(f"\n[4/8] Applying SMOTE (training set only)")
    print(f"       Before: {dict(zip(*np.unique(y_train, return_counts=True)))}")
    sm = SMOTE(random_state=42)
    X_res, y_res = sm.fit_resample(X_train, y_train)
    print(f"       After:  {dict(zip(*np.unique(y_res, return_counts=True)))}")
    return X_res, y_res


def train_and_evaluate(X_train, y_train, X_test, y_test):
    """Train 3 models, cross-validate, report metrics, return the best."""

    models = {
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.1,
            use_label_encoder=False, eval_metric="logloss",
            random_state=42, verbosity=0,
        ),
        "AdaBoost": AdaBoostClassifier(
            n_estimators=150, learning_rate=0.1, random_state=42,
        ),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            random_state=42,
        ),
    }

    # Scoring functions
    scoring = {
        "accuracy": "accuracy",
        "roc_auc": "roc_auc",
        "precision": "precision",
        "recall": "recall",
        "f1": "f1",
    }

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    results = {}
    best_model = None
    best_score = -1
    best_name = ""

    print(f"\n[5/8] Training 3 models with 5-fold StratifiedKFold CV...")
    print(f"{'='*60}")

    for name, clf in models.items():
        print(f"\n  ▸ {name}")

        # Cross-validation on training set
        cv_results = cross_validate(
            clf, X_train, y_train,
            cv=skf, scoring=scoring,
            return_train_score=False,
        )

        # Fit on full training set
        clf.fit(X_train, y_train)

        # Evaluate on held-out test set
        y_pred = clf.predict(X_test)
        y_proba = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else y_pred

        acc = accuracy_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_proba)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        kappa = cohen_kappa_score(y_test, y_pred)

        # Store results
        results[name] = {
            "accuracy": acc, "auc_roc": auc, "precision": prec,
            "recall": rec, "f1": f1, "kappa": kappa,
            "cv_accuracy_mean": cv_results["test_accuracy"].mean(),
            "cv_auc_mean": cv_results["test_roc_auc"].mean(),
        }

        # Report
        print(f"    Test Accuracy:     {acc:.4f}")
        print(f"    Test AUC-ROC:      {auc:.4f}")
        print(f"    Test Precision:    {prec:.4f}")
        print(f"    Test Recall:       {rec:.4f}")
        print(f"    Test F1:           {f1:.4f}")
        print(f"    Test Cohen's κ:    {kappa:.4f}")
        print(f"    CV Accuracy (5F):  {cv_results['test_accuracy'].mean():.4f} ± {cv_results['test_accuracy'].std():.4f}")
        print(f"    CV AUC-ROC  (5F):  {cv_results['test_roc_auc'].mean():.4f} ± {cv_results['test_roc_auc'].std():.4f}")

        # ── LEAKAGE WARNING ──────────────────────────────────────
        if acc > 0.98:
            print(f"\n  ⚠⚠⚠  WARNING: {name} accuracy is {acc:.4f} (>98%)")
            print(f"        This may indicate DATA LEAKAGE.")
            print(f"        Verify that the 'result' column has been dropped.")
            print(f"        Check that no target-correlated features remain.\n")

        # Track best
        composite = (auc + f1) / 2
        if composite > best_score:
            best_score = composite
            best_model = clf
            best_name = name

    print(f"\n{'='*60}")
    print(f"  ✓ Best model: {best_name} (composite AUC+F1 = {best_score:.4f})")

    return best_model, best_name, results


def save_artifacts(model, encoders, background, model_path, encoders_path, background_path):
    """Save trained model artifacts to disk."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)

    joblib.dump(model, model_path)
    print(f"\n[7/8] Saved model → {model_path}")

    joblib.dump(encoders, encoders_path)
    print(f"[8/8] Saved encoders → {encoders_path}")

    np.save(background_path, background)
    print(f"[8/8] Saved LIME background → {background_path}")


def train_category(category: str):
    """Run the full training pipeline for one category."""
    config = CATEGORY_MODEL_CONFIG[category]
    data_path = None
    for path in config["dataset_paths"]:
        path_str = str(path)
        if os.path.exists(path_str):
            data_path = path_str
            break
    if data_path is None:
        print(f"\n[SKIP] No dataset for '{category}'. Expected at:")
        for path in config["dataset_paths"]:
            print(f"  {path}")
        return

    df = load_and_clean(data_path, category)
    print(f"\n[2/8] Encoding categorical features...")
    df, encoders = encode_features(df)
    X, y = build_feature_matrix(df)
    print(f"\n[3/8] Splitting: 80% train / 20% test (stratified)")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"       Train: {X_train.shape[0]} samples")
    print(f"       Test:  {X_test.shape[0]} samples")
    X_train_res, y_train_res = apply_smote(X_train, y_train)
    best_model, best_name, results = train_and_evaluate(
        X_train_res, y_train_res, X_test, y_test,
    )
    background = X_train_res[: min(len(X_train_res), 256)]
    save_artifacts(
        best_model,
        encoders,
        background,
        str(config["model_path"]),
        str(config["encoders_path"]),
        str(config["background_path"]),
    )
    print(f"\n{'='*60}")
    print(f"  {category.upper()} training complete!")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Train NeuroSense ASD models.")
    parser.add_argument(
        "--category",
        choices=sorted(CATEGORY_MODEL_CONFIG.keys()),
        help="Train a specific category. Omit to train both.",
    )
    args = parser.parse_args()
    categories = [args.category] if args.category else sorted(CATEGORY_MODEL_CONFIG.keys())
    for cat in categories:
        train_category(cat)
    print("\nDone. Run: uvicorn backend.main:app --reload")


if __name__ == "__main__":
    main()
