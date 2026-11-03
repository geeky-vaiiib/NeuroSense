"""Licensed local expression/emotion/eye-tracker experiments; no application result changes.

python -m backend.data.train_research_modalities --task facial --smoke
python -m backend.data.train_research_modalities --task speech
python -m backend.data.train_research_modalities --task gaze
Raw/caches/private manifests: ignored research-data and experiments. Never loads DASD.
"""
from __future__ import annotations
import argparse,copy,hashlib,json,platform,re,time
from pathlib import Path
from collections import Counter
import numpy as np
import pandas as pd
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score,balanced_accuracy_score,f1_score,recall_score,confusion_matrix,roc_auc_score
from backend.ml.research_models import (CompactCNN,EyeTrackerBiLSTM,face_input,audio_inputs,FACE_CLASSES,SPEECH_CLASSES,FACE_SCHEMA,SPEECH_SCHEMA,GAZE_SCHEMA)
from backend.data.evaluate_gaze_development import git_provenance

ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/'research-data';SEED=20261104

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,d):Path(p).write_text(json.dumps(d,indent=2,allow_nan=False)+'\n')
def numbers(s):return pd.to_numeric(s.astype(str).str.replace(',','.',regex=False),errors='coerce')
def metrics(y,p,nclasses):
 y=np.asarray(y);p=np.asarray(p);pred=p.argmax(1);out={'n':len(y),'accuracy':float(accuracy_score(y,pred)),
 'balanced_accuracy':float(balanced_accuracy_score(y,pred)), 'macro_f1':float(f1_score(y,pred,labels=range(nclasses),average='macro',zero_division=0)),
 'per_class_recall':recall_score(y,pred,labels=range(nclasses),average=None,zero_division=0).tolist(),
 'confusion_matrix':confusion_matrix(y,pred,labels=range(nclasses)).tolist()}
 if nclasses==2:
  out.update(sensitivity=out['per_class_recall'][1],specificity=out['per_class_recall'][0],roc_auc=float(roc_auc_score(y,p[:,1])) if len(set(y))==2 else None)
 return out

def interval(y,p,groups,nclasses,draws=1000):
 rng=np.random.default_rng(SEED);groups=np.asarray(groups);people=np.unique(groups);values=[]
 for _ in range(draws):
  ix=np.concatenate([np.flatnonzero(groups==g) for g in rng.choice(people,len(people),replace=True)])
  if len(set(np.asarray(y)[ix]))!=nclasses:continue
  values.append([accuracy_score(np.asarray(y)[ix],p[ix].argmax(1)),f1_score(np.asarray(y)[ix],p[ix].argmax(1),labels=range(nclasses),average='macro',zero_division=0)])
 return {'method':'participant/speaker cluster bootstrap, conditional on fitted model','draws_with_all_classes':len(values),
 'accuracy_ci95':np.quantile(np.array(values)[:,0],[.025,.975]).tolist() if values else None,
 'macro_f1_ci95':np.quantile(np.array(values)[:,1],[.025,.975]).tolist() if values else None}

def split_people(ids,labels):
 a,b=train_test_split(ids,test_size=.4,stratify=labels,random_state=SEED)
 by=dict(zip(ids,labels));v,t=train_test_split(b,test_size=.5,stratify=[by[x] for x in b],random_state=SEED)
 return {str(x):s for s,group in [('train',a),('validation',v),('test',t)] for x in group}

def facial():
 cache=DATA/'facial_cache.npz';audit=DATA/'facial_audit.json'
 if cache.exists():return dict(np.load(cache,allow_pickle=False)),json.loads(audit.read_text())
 import cv2
 from skimage.feature import hog
 meta=next((DATA/'facial').rglob('images.csv'));base=meta.parent;d=pd.read_csv(meta)
 people=sorted(d.loc[d.split=='development','identity'].unique());rng=np.random.default_rng(SEED);rng.shuffle(people)
 val=set(people[:17]);splits={pid:('test' if (d[d.identity==pid].split=='held-out').all() else 'validation' if pid in val else 'train') for pid in d.identity.unique()}
 rows=[];ex=[];seen={}
 for row in d.itertuples():
  p=base/row.file
  if sha(p)!=row.sha256:raise ValueError('facial image checksum mismatch')
  digest=sha(p)
  if digest in seen and seen[digest]!=row.identity:raise ValueError('duplicate image crosses identities')
  seen[digest]=row.identity
  bgr=cv2.imread(str(p));x=face_input(bgr) if bgr is not None else None
  if x is None:ex.append({'class':row.expression,'split':splits[row.identity],'reason':'no_face'});continue
  feature=hog(x[0],pixels_per_cell=(8,8),cells_per_block=(2,2),feature_vector=True)
  rows.append((x,feature,FACE_CLASSES.index(row.expression),row.identity,splits[row.identity],row.file))
 result={k:np.stack([r[i] for r in rows]) for i,k in enumerate(['x','features','y','group','split','sample'])}
 np.savez_compressed(cache,**result);info={'dataset':'V_Expression v1 / attributed course v1.0','licence':'CC BY 4.0','published_description_people':168,'actual_people':len(d.identity.unique()),'actual_images':len(d),'excluded':ex,'archive_sha256':sha(DATA/'downloads/v_expression_course_v1.zip'),'classes':list(FACE_CLASSES),'schema':FACE_SCHEMA}
 write(audit,info);return result,info

def speech():
 cache=DATA/'speech_cache.npz';audit=DATA/'speech_audit.json'
 if cache.exists():return dict(np.load(cache,allow_pickle=False)),json.loads(audit.read_text())
 import librosa
 rng=np.random.default_rng(SEED);splits={}
 for parity in [0,1]:
  ids=np.arange(1,25);ids=ids[ids%2==parity];rng.shuffle(ids)
  for name,part in [('train',ids[:8]),('validation',ids[8:10]),('test',ids[10:])]:
   splits.update({str(x):name for x in part})
 rows=[];ex=[];seen={}
 for p in sorted((DATA/'ravdess').rglob('*.wav')):
  parts=p.stem.split('-');actor=str(int(parts[-1]));label=int(parts[2])-1
  digest=sha(p)
  if digest in seen and seen[digest]!=actor:raise ValueError('duplicate audio crosses actors')
  seen[digest]=actor
  try:
   wave,sr=librosa.load(p,sr=16000,mono=True);mels,feature=audio_inputs(wave,sr)
   for mel in mels:rows.append((mel,feature,label,actor,splits[actor],p.stem))
  except ValueError as e:ex.append({'class':SPEECH_CLASSES[label],'split':splits[actor],'reason':str(e)})
 result={k:np.stack([r[i] for r in rows]) for i,k in enumerate(['x','features','y','group','split','sample'])}
 np.savez_compressed(cache,**result);info={'dataset':'RAVDESS audio speech v1.0.0','licence':'CC BY-NC-SA 4.0, noncommercial research only','actual_people':24,'actual_recordings':1440,'excluded':ex,'archive_sha256':sha(DATA/'downloads/ravdess_speech_v1.zip'),'classes':list(SPEECH_CLASSES),'schema':SPEECH_SCHEMA}
 write(audit,info);return result,info

def gaze():
 cache=DATA/'gaze_cache.npz';audit=DATA/'gaze_audit.json'
 if cache.exists():return dict(np.load(cache,allow_pickle=False)),json.loads(audit.read_text())
 root=DATA/'gaze';meta=pd.read_csv(next(root.rglob('Metadata*csv')))
 if set(meta.Class)!={'ASD','TD'} or meta.ParticipantID.duplicated().any():raise ValueError('invalid gaze metadata labels/IDs')
 labels={str(int(r.ParticipantID)):int(r.Class=='ASD') for r in meta.itertuples()}
 splits=split_people(list(labels),list(labels.values()));windows={pid:[] for pid in labels};context={pid:[] for pid in labels};ex=Counter()
 columns=['Participant','Trial','Stimulus','RecordingTime [ms]','Point of Regard Right X [px]','Point of Regard Right Y [px]','Point of Regard Left X [px]','Point of Regard Left Y [px]']
 for p in sorted(root.rglob('*.csv')):
  if 'Metadata' in p.name:continue
  d=pd.read_csv(p,usecols=lambda c:c in columns,low_memory=False)
  for c in columns[3:]:
   if c in d:d[c]=numbers(d[c])
  for keys,frame in d.groupby(['Participant','Trial','Stimulus'],dropna=False,sort=False):
   try:pid=str(int(keys[0]))
   except (ValueError,TypeError):ex['unidentified_participant_frames']+=len(frame);continue
   if pid not in labels:raise ValueError('gaze recording participant missing from metadata')
   t=frame['RecordingTime [ms]'].to_numpy(float)/1000
   xs=[frame[c].to_numpy(float) for c in columns if 'X [px]' in c and c in frame];ys=[frame[c].to_numpy(float) for c in columns if 'Y [px]' in c and c in frame]
   if not xs or not ys:ex['missing_coordinates']+=len(frame);continue
   with np.errstate(invalid='ignore'):
    x=np.nanmean(xs,axis=0);y=np.nanmean(ys,axis=0)
   valid=np.isfinite(t)&np.isfinite(x)&np.isfinite(y)&(x>0)&(y>0)&(x<10000)&(y<10000)
   ex['invalid_frames']+=int((~valid).sum());t=t[valid];xy=np.stack([x[valid],y[valid]],1)
   if len(t)<2:continue
   order=np.argsort(t,kind='stable');t=t[order];xy=xy[order];unique=np.r_[True,np.diff(t)>0];t=t[unique];xy=xy[unique]
   if len(t)<2 or t[-1]-t[0]>600:ex['invalid_or_overlong_trial']+=1;continue
   grid=np.arange(t[0],t[-1],.05)
   if len(grid)<80:ex['short_trial']+=1;continue
   right=np.searchsorted(t,grid).clip(1,len(t)-1);holes=(t[right]-t[right-1])>.25
   seq=np.stack([np.interp(grid,t,xy[:,j]) for j in range(2)],1)
   for start in range(0,len(seq)-79,40):
    if holes[start:start+80].mean()>.2:ex['gappy_window']+=1;continue
    w=seq[start:start+80].copy();w-=w.mean(0);windows[pid].append(w.astype(np.float32))
   context[pid].append([t[-1]-t[0],len(t),len(t)/(t[-1]-t[0]),valid.mean()])
 rows=[]
 for pid in labels:
  wins=windows[pid]
  if not wins:ex['participants_without_usable_windows']+=1;continue
  chosen=np.linspace(0,len(wins)-1,min(30,len(wins))).round().astype(int)
  ctx=np.mean(context[pid],axis=0)
  for i in chosen:
   w=wins[i];feature=np.r_[w.std(0),np.quantile(w,.1,axis=0),np.quantile(w,.9,axis=0)]
   rows.append((w,feature,labels[pid],pid,splits[pid],pid,ctx))
 result={k:np.stack([r[i] for r in rows]) for i,k in enumerate(['x','features','y','group','split','sample','context'])}
 np.savez_compressed(cache,**result);info={'dataset':'Cilia Figshare 20113592 v1','licence':'CC BY 4.0','metadata_people':len(meta),'actual_people':len(np.unique(result['group'])),'excluded':dict(ex),'archive_sha256':sha(DATA/'downloads/gaze_figshare_v1.zip'),'classes':['TD','ASD'],'schema':GAZE_SCHEMA,'webcam_compatible':False,'diagnostic_provenance':'metadata Class and CARS fields; independent assessment procedure not verified'}
 write(audit,info);return result,info

def aggregate(y,p,keys,groups):
 ids=np.unique(keys);return np.array([y[np.flatnonzero(keys==k)[0]] for k in ids]),np.stack([p[keys==k].mean(0) for k in ids]),np.array([groups[np.flatnonzero(keys==k)[0]] for k in ids])

def fit_cnn(data,task,epochs,smoke=False,shuffle=False):
 torch.manual_seed(SEED);torch.set_num_threads(2);torch.use_deterministic_algorithms(True)
 train=np.flatnonzero(data['split']=='train');val=np.flatnonzero(data['split']=='validation')
 if smoke:train=train[:min(64,len(train))];val=val[:min(32,len(val))]
 x=data['x'].astype(np.float32).copy()
 if shuffle:
  rng=np.random.default_rng(SEED)
  for row in x:row[:]=row[rng.permutation(len(row))]
 norm=None
 if task=='gaze':
  mean=x[train].mean((0,1));std=x[train].std((0,1));std=np.maximum(std,1e-6);x=(x-mean)/std;norm={'mean':mean.tolist(),'std':std.tolist()}
 model=EyeTrackerBiLSTM() if task=='gaze' else CompactCNN(len(FACE_CLASSES) if task=='facial' else len(SPEECH_CLASSES))
 opt=torch.optim.AdamW(model.parameters(),lr=.001,weight_decay=.01);criterion=torch.nn.CrossEntropyLoss(reduction='none')
 nclass=2 if task=='gaze' else 7 if task=='facial' else 8
 counts=np.bincount(data['y'][train].astype(int),minlength=nclass);weights=np.array([1/max(1,counts[int(y)]) for y in data['y'][train]])
 if task=='gaze':
  group_counts=Counter(data['group'][train]);class_people=Counter(data['y'][train][np.unique(data['group'][train],return_index=True)[1]])
  weights=np.array([1/(group_counts[g]*class_people[y]) for g,y in zip(data['group'][train],data['y'][train])])
 weights=weights/weights.mean();tensor=torch.from_numpy(x);target=torch.tensor(data['y'].astype(int),dtype=torch.long);best=-1;state=None;history=[];bad=0
 for epoch in range(1,epochs+1):
  model.train();order=torch.randperm(len(train));losses=[]
  for start in range(0,len(order),32):
   take=order[start:start+32];ix=train[take.numpy()];batch=tensor[ix].clone()
   if task=='facial':
    if torch.rand(())<.5:batch=torch.flip(batch,[-1])
    batch=torch.roll(batch,(int(torch.randint(-3,4,())),int(torch.randint(-3,4,()))),(-2,-1))
    batch=(batch*(.9+.2*torch.rand(()))).clamp(-1,1)
   if task=='speech':
    # Fixed training-only narrow time masking, never validation/test augmentation.
    off=int(torch.randint(0,batch.shape[-1]-8,()));batch[:,:,:,off:off+8]=0
   loss=(criterion(model(batch),target[ix])*torch.tensor(weights[take.numpy()],dtype=torch.float32)).mean()
   opt.zero_grad();loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1.);opt.step();losses.append(float(loss.detach()))
  p=predict(model,tensor[val]);yv,pv,_=aggregate(data['y'][val],p,data['sample'][val],data['group'][val]);f=metrics(yv,pv,nclass)['macro_f1']
  history.append({'epoch':epoch,'train_loss':float(np.mean(losses)),'validation_macro_f1':f});print(task,'shuffled' if shuffle else '',epoch,'validation macroF1',round(f,4),flush=True)
  if f>best+1e-6:best=f;state=copy.deepcopy(model.state_dict());best_epoch=epoch;bad=0
  else:bad+=1
  if bad>=10:break
 model.load_state_dict(state);model.eval();return model,norm,history,best_epoch,x

def predict(model,x):
 model.eval()
 with torch.no_grad():return np.concatenate([torch.softmax(model(torch.as_tensor(x[i:i+64],dtype=torch.float32)),1).numpy() for i in range(0,len(x),64)])

def baseline(data,features):
 tr=data['split']=='train';model=make_pipeline(StandardScaler(),LogisticRegression(C=1,max_iter=2000,class_weight='balanced'))
 # Gaze is one row per person, not one independent row per overlapping window.
 keys=np.unique(data['group']) if data['x'].ndim==3 else np.arange(len(features))
 if data['x'].ndim==3:
  f=np.stack([features[data['group']==g].mean(0) for g in keys]);y=np.array([data['y'][np.flatnonzero(data['group']==g)[0]] for g in keys]);train=np.array([data['split'][np.flatnonzero(data['group']==g)[0]]=='train' for g in keys]);model.fit(f[train],y[train]);probs=model.predict_proba(f);return np.stack([probs[np.flatnonzero(keys==g)[0]] for g in data['group']])
 model.fit(features[tr],data['y'][tr]);return model.predict_proba(features)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--task',choices=['facial','speech','gaze'],required=True);ap.add_argument('--smoke',action='store_true');ap.add_argument('--epochs',type=int);a=ap.parse_args();t=time.time()
 run=ROOT/'experiments'/('smoke-'+a.task if a.smoke else a.task+'-v1');run.mkdir(parents=True,exist_ok=False)
 data,info={'facial':facial,'speech':speech,'gaze':gaze}[a.task]()
 for group in np.unique(data['group']):
  if len(set(data['split'][data['group']==group]))!=1:raise ValueError('participant leakage')
 write(run/'private_manifest.json',{'group':data['group'].tolist(),'sample':data['sample'].tolist(),'split':data['split'].tolist(),'label':data['y'].tolist()})
 epochs=a.epochs or (2 if a.smoke else {'facial':45,'speech':35,'gaze':35}[a.task]);model,norm,history,best_epoch,x=fit_cnn(data,a.task,epochs,a.smoke)
 if a.smoke:write(run/'smoke.json',{'status':'smoke_only','history':history,'test_evaluated':False});return
 k=len(info['classes']);report={'dataset':info,'seed':SEED,'environment':{'python':platform.python_version(),'torch':torch.__version__,'numpy':np.__version__,'pandas':pd.__version__,'sklearn':__import__('sklearn').__version__,'device':'CPU','threads':2},'history':history,'selected_epoch':best_epoch,'classes':info['classes'],'schema':info['schema'],'source_sha256':sha(__file__),**git_provenance(ROOT),'calibrated':False,'screening_eligible':False,'smoke':False,'splits':{},'metrics':{}}
 for split in ['train','validation','test']:
  ix=data['split']==split;report['splits'][split]={'participants':len(np.unique(data['group'][ix])),'samples':len(np.unique(data['sample'][ix])),'windows_or_chunks':int(ix.sum()),'class_balance_samples':dict(Counter(str(int(data['y'][np.flatnonzero(data['sample']==s)[0]])) for s in np.unique(data['sample'][ix])))}
 probs=predict(model,x);base=baseline(data,data['features']);arms={'cnn' if a.task!='gaze' else 'bilstm':probs,'statistical_baseline':base}
 if a.task=='gaze':
  arms['metadata_control']=baseline(data,data['context']);shuf,snorm,shistory,sepoch,sx=fit_cnn(data,a.task,epochs,shuffle=True);arms['temporal_shuffle_control']=predict(shuf,sx);report['shuffle_validation_history']=shistory
 for name,p in arms.items():
  report['metrics'][name]={}
  for split in ['validation','test']:
   ix=data['split']==split;y,q,g=aggregate(data['y'][ix],p[ix],data['sample'][ix],data['group'][ix]);report['metrics'][name][split]={**metrics(y,q,k),**interval(y,q,g,k)}
 if a.task=='gaze':integrated=False
 else:
  val=report['metrics']['cnn']['validation'];test=report['metrics']['cnn']['test'];integrated=val['macro_f1']>=(.35 if a.task=='facial' else .30) and test['balanced_accuracy']>1/k
 report['integration_eligible']=integrated;report['seconds']=round(time.time()-t,2)
 out=ROOT/'backend/models/research'/f'{a.task}-v1';out.mkdir(parents=True,exist_ok=False);torch.save({'state_dict':model.state_dict()},out/'weights.pt')
 metadata={'version':f'{a.task}-v1','task':a.task,'schema':info['schema'],'classes':info['classes'],'architecture':'EyeTrackerBiLSTM(2,24)' if a.task=='gaze' else 'CompactCNN(16,32,64,128)','weights_sha256':sha(out/'weights.pt'),'normalizer':norm,'dataset':info['dataset'],'licence':info['licence'],'integration_eligible':integrated,'experimental':True,'calibrated':False,'screening_eligible':False,'population':'adult technical research only; transfer unvalidated' if a.task!='gaze' else 'source eye-tracker cohort only','report':f'backend/reports/research/{a.task}-v1.json','private_split_manifest_sha256':sha(run/'private_manifest.json')}
 write(out/'metadata.json',metadata);reports=ROOT/'backend/reports/research';reports.mkdir(exist_ok=True);write(reports/f'{a.task}-v1.json',report);write(run/'report.json',report)
 print('FINISHED',a.task,'eligible',integrated,'test',report['metrics'][list(arms)[0]]['test'],flush=True)
if __name__=='__main__':main()
