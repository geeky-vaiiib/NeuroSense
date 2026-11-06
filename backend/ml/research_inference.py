"""Optional, checksum-verified expression/emotion inference. Never a screening signal."""
from __future__ import annotations
import hashlib,json,logging
from pathlib import Path
from functools import lru_cache
import numpy as np
import torch
from .research_models import CompactCNN,FACE_CLASSES,SPEECH_CLASSES,FACE_SCHEMA,SPEECH_SCHEMA,face_input,audio_inputs

ROOT=Path(__file__).resolve().parents[1]/'models/research'
EXPECTED={'facial':(FACE_SCHEMA,FACE_CLASSES),'speech':(SPEECH_SCHEMA,SPEECH_CLASSES)}
LOG=logging.getLogger('neurosense.research_models')

@lru_cache(maxsize=2)
def load_model(task):
    """Trusted shipped state dict only; corruption leaves optional capability unavailable."""
    try:
        schema,classes=EXPECTED[task];folder=ROOT/f'{task}-v1';meta=json.loads((folder/'metadata.json').read_text());weights=folder/'weights.pt'
        if (meta['schema']!=schema or tuple(meta['classes'])!=classes or meta['task']!=task
                or meta.get('architecture') != 'CompactCNN(16,32,64,128)' or meta.get('normalizer') is not None
                or not meta['integration_eligible'] or meta.get('screening_eligible') is not False
                or hashlib.sha256(weights.read_bytes()).hexdigest()!=meta['weights_sha256']):
            raise ValueError('incompatible or unapproved research artifact')
        model=CompactCNN(len(classes));model.load_state_dict(torch.load(weights,map_location='cpu',weights_only=True)['state_dict']);model.eval()
        return model,meta
    except Exception as exc:
        LOG.warning('%s optional research model unavailable (%s): %s',task,type(exc).__name__,exc)
        return None,None

def unavailable(task,reason,status='model_unavailable'):
    return {'task':'facial_expression' if task=='facial' else 'speech_emotion','status':status,'output':None,'model':None,'reason':reason}

def classify(task,x):
    model,meta=load_model(task)
    if model is None:return unavailable(task,'Optional research checkpoint unavailable or incompatible.')
    try:
        x=np.asarray(x,dtype=np.float32)
        expected=(1,64,64) if task=='facial' else (1,64,126)
        if x.ndim!=4 or tuple(x.shape[1:])!=expected or not len(x) or not np.isfinite(x).all():raise ValueError('invalid model input')
        with torch.inference_mode():p=torch.softmax(model(torch.from_numpy(x)),1).numpy().mean(0)
        if not np.isfinite(p).all() or not np.isclose(p.sum(),1,atol=1e-5):raise ValueError('invalid model output')
        return {'task':'facial_expression' if task=='facial' else 'speech_emotion','status':'available_experimental',
                'output':{'kind':'facial_expression' if task=='facial' else 'speech_emotion','label':meta['classes'][int(p.argmax())],
                          'class_scores':dict(zip(meta['classes'],map(float,p))),'calibrated':False,
                          'meaning':'Uncalibrated posed-expression/emotion class scores; not autism prediction or a measurement of internal feelings.'},
                'model':{'version':meta['version'],'dataset':meta['dataset'],'schema':meta['schema'],'validated':False,
                         'weights_sha256':meta['weights_sha256'],'licence':meta['licence']},
                'reason':'Adult technical research only; age/device/task/language transfer unvalidated. Excluded from screening.'}
    except Exception:
        LOG.exception('%s research inference failed',task)
        return unavailable(task,'Research model inference failed; see server logs.','analysis_failed')

def face_expression(bgr):
    try:
        x=face_input(bgr)
        return unavailable('facial','No usable detected face.','failed_quality') if x is None else classify('facial',x[None])
    except Exception:
        LOG.exception('Expression preprocessing failed')
        return unavailable('facial','Expression preprocessing failed.','analysis_failed')

def speech_emotion(wave,sr):
    try:
        x,_=audio_inputs(wave,sr);return classify('speech',x)
    except ValueError as exc:return unavailable('speech',str(exc),'failed_quality')
    except Exception:
        LOG.exception('Emotion preprocessing failed')
        return unavailable('speech','Emotion preprocessing failed.','analysis_failed')

def state(result):
    from .modality_status import _state
    mid=result['task'];return _state(mid,'Facial expression (CNN, experimental)' if mid=='facial_expression' else 'Speech emotion (CNN, experimental)',
        result['status'],reason=result.get('reason'),model=result.get('model'),output=result.get('output'))
