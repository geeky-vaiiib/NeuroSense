"""Explicit offline screen-pixel inference. Never a webcam or screening adapter."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import torch
from .research_models import EyeTrackerBiLSTM, GAZE_SCHEMA

ROOT = Path(__file__).resolve().parents[1] / 'models/research/gaze-v1'

def infer(payload):
    if payload.get('schema') != GAZE_SCHEMA:
        raise ValueError('Incompatible schema: expected centered 20 Hz eye-tracker screen pixels, never webcam angles.')
    if payload.get('provenance') not in ('permitted_research_recording', 'synthetic_numeric_engineering_fixture'):
        raise ValueError('Declare permitted recording or synthetic numeric engineering fixture provenance.')
    x = np.asarray(payload.get('windows'), dtype=np.float32)
    if x.ndim != 3 or x.shape[1:] != (80, 2) or not 1 <= len(x) <= 30 or not np.isfinite(x).all():
        raise ValueError('Expected 1–30 finite windows, each 80 samples x 2 centered pixel coordinates.')
    if np.max(np.abs(x.mean(1))) > .01 or np.max(np.abs(x)) > 10000:
        raise ValueError('Windows must use training centering and pixel bounds; do not submit normalized webcam angles.')
    meta = json.loads((ROOT / 'metadata.json').read_text())
    path = ROOT / 'weights.pt'
    if (meta['schema'] != GAZE_SCHEMA or meta['classes'] != ['TD','ASD']
            or meta['architecture'] != 'EyeTrackerBiLSTM(2,24)' or meta['screening_eligible'] is not False
            or hashlib.sha256(path.read_bytes()).hexdigest() != meta['weights_sha256']):
        raise ValueError('Eye-tracker artifact contract/hash mismatch')
    mean, std = np.asarray(meta['normalizer']['mean']), np.asarray(meta['normalizer']['std'])
    if mean.shape != (2,) or std.shape != (2,) or not np.isfinite([mean,std]).all() or np.any(std <= 0):
        raise ValueError('Invalid frozen normalizer')
    model = EyeTrackerBiLSTM()
    model.load_state_dict(torch.load(path, map_location='cpu', weights_only=True)['state_dict']); model.eval()
    with torch.inference_mode():
        p = torch.softmax(model(torch.from_numpy(((x-mean)/std).astype(np.float32))),1).numpy().mean(0)
    if not np.isfinite(p).all(): raise ValueError('Nonfinite model output')
    return {'id':'eye_tracker','status':'available_experimental','output':{'kind':'eye_tracker_cohort_output',
        'label':meta['classes'][int(p.argmax())], 'class_scores':dict(zip(meta['classes'],map(float,p))),
        'calibrated':False,'meaning':'Source cohort class scores, not diagnosis or calibrated probability. Not webcam compatible.'},
        'model':{k:meta[k] for k in ('version','schema','weights_sha256','licence')},
        'quality':{'window_count':len(x),'sample_rate_hz':20,'window_duration_s':4},
        'reason':'Separate eye-tracker research only; never included in questionnaire screening.',
        'provenance':payload['provenance']}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path);parser.add_argument('output',type=Path)
    a=parser.parse_args()
    if a.input.stat().st_size > 2_000_000: raise ValueError('Research input exceeds 2 MB')
    result=infer(json.loads(a.input.read_text()))
    with a.output.open('x') as f: json.dump(result,f,indent=2,allow_nan=False)

if __name__=='__main__':main()
