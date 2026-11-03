"""Export fixed training-only LR baselines; no test metrics or model selection."""
import argparse,json
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from backend.data.train_research_modalities import ROOT,facial,speech,gaze,sha

def export(task):
 data,info={'facial':facial,'speech':speech,'gaze':gaze}[task]();f=data['features'];y=data['y'];train=data['split']=='train'
 if task=='gaze':
  groups=np.unique(data['group']);f=np.stack([f[data['group']==g].mean(0) for g in groups]);indices=[np.flatnonzero(data['group']==g)[0] for g in groups];y=y[indices];train=train[indices]
 model=make_pipeline(StandardScaler(),LogisticRegression(C=1,max_iter=2000,class_weight='balanced'));model.fit(f[train],y[train])
 scaler,lr=model.steps[0][1],model.steps[1][1]
 result={'version':f'{task}-statistical-lr-v1','algorithm':'StandardScaler + balanced LogisticRegression(C=1)','task':task,'schema':info['schema'],'classes':info['classes'],'coef':lr.coef_.tolist(),'intercept':lr.intercept_.tolist(),'mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'licence':info['licence'],'feature_dimension':f.shape[1],'feature_order':'HOG grayscale64 (skimage defaults)' if task=='facial' else '20 MFCC means,20 MFCC SDs,ZCR,RMS,centroid' if task=='speech' else 'window SDx,SDy,p10x,p10y,p90x,p90y; participant mean','training_only':True,'baseline_report':f'backend/reports/research/{task}-v1.json','screening_eligible':False,'calibrated':False,'export_source_sha256':sha(__file__)}
 path=ROOT/f'backend/models/research/{task}-v1/baseline.json'
 with path.open('x') as out:json.dump(result,out,indent=2)
 print(task,'baseline exported; no test evaluation')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--task',choices=['facial','speech','gaze'],required=True);export(p.parse_args().task)
