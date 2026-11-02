"""Read-only lightweight checks of shipped predictions, splits and checkpoint. No training."""
from __future__ import annotations
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, brier_score_loss

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.data.qchat_polish import load_clean
from backend.ml.toddler_model import ToddlerModel
from backend.ml import qchat10 as Q


def main():
    d=ROOT/'backend/reports/toddler_qchat'
    split=pd.read_csv(d/'participant_split.csv')
    dev=pd.read_csv(d/'dev_oof_predictions.csv')
    hold=pd.read_csv(d/'holdout_predictions.csv')
    assert not split.child_id.duplicated().any()
    assert not set(dev.child_id)&set(hold.child_id)
    assert set(dev.child_id)==set(split.loc[split.set=='dev','child_id'])
    assert set(hold.child_id)==set(split.loc[split.set=='holdout','child_id'])
    data=load_clean().set_index('child_id')
    m=ToddlerModel(ROOT/'backend/models/toddler_qchat10_polish_v1')
    predicted=[]
    for row in hold.itertuples():
        raw=data.loc[row.child_id]
        recodes=[int(raw[c]) for c in Q.DATASET_COLUMNS]
        assert row.official_points==sum(x>=2 for x in recodes)
        predicted.append(m.predict_proba(m.features(recodes)))
    error=float(np.max(np.abs(np.array(predicted)-hold.probability)))
    assert error<1e-10
    result={'participant_overlap':0,'dev_n':len(dev),'holdout_n':len(hold),
            'holdout_auc':roc_auc_score(hold.y,hold.probability),
            'official_points_holdout_auc':roc_auc_score(hold.y,hold.official_points),
            'holdout_brier':brier_score_loss(hold.y,hold.probability),
            'checkpoint_vs_saved_prediction_max_abs_error':error,
            'scope':'stored artifacts only; not independent cohort or training reproduction'}
    # Participant bootstrap rechecks sampling uncertainty without model fitting.
    rng=np.random.default_rng(2026)
    aucs=[]
    for _ in range(2000):
        idx=rng.integers(0,len(hold),len(hold)); rows=hold.iloc[idx]
        if rows.y.nunique()==2: aucs.append(roc_auc_score(rows.y,rows.probability))
    result['recomputed_holdout_auc_ci95_2000_bootstraps']=np.quantile(aucs,[.025,.975]).tolist()
    print(json.dumps(result,indent=2))

if __name__=='__main__': main()
