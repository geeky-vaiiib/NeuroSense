"""Read-only gaze metadata/repeat arithmetic and optional licensed split inventory.

Does not rerun training or infer a clinical validity claim from technical checks.
"""
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.data import dasd


def main():
    report=json.loads((ROOT/'backend/reports/model_selection/model_comparison.json').read_text())
    meta=json.loads((ROOT/'backend/models/gaze_openface_dasd_v3_metadata.json').read_text())
    r=report['results']['BiLSTM / gaze-only']
    mean=sum(x['auc'] for x in r['repeats'])/len(r['repeats'])
    assert abs(mean-r['auc']['mean'])<1e-12
    assert abs(meta['metrics']['dev_cv_55']['auc']['mean']-mean)<1e-12
    assert report['selection']['chosen']=='BiLSTM / gaze-only'
    assert meta['feature_names']==['gaze_angle_x','gaze_angle_y']
    out={'selected':report['selection']['chosen'],'dev_auc_recomputed_repeat_mean':mean,
         'deployed_feature_names':meta['feature_names'],
         'scope':'saved metric arithmetic and split inventory only; no training reproduction'}
    recs=dasd.optional_recordings()
    if recs is None:
        out['raw_data_check']='unavailable: licensed DASD not installed'
    else:
        dev,test=dasd.official_split(recs); dasd.assert_disjoint(dev,test)
        out.update(n_discovered=len(recs),dev=len(dev),test=len(test),participant_id_overlap=0)
    print(json.dumps(out,indent=2))

if __name__=='__main__': main()
