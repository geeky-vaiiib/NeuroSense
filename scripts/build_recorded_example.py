"""Explicitly regenerate a labelled aggregate example from licensed local research data.
No raw media, participant IDs, or private split manifests are written to the report.
Never downloads data, trains, tunes, joins participants or touches a database.
"""
import json
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import torch
from backend.ml.research_inference import state
from backend.ml.eye_tracker_research import infer
from backend.ml.research_models import GAZE_SCHEMA
from backend.ml.questionnaire_score import score_questionnaire
from backend.ml.modality_status import questionnaire_state
from backend.core.reports import build_report

def main():
    torch.set_num_threads(2)
    root=Path('research-data')
    # Select development fixtures using the already saved training cache and manifests,
    # never tune/select on prediction or the held-out test.
    from backend.data.train_research_modalities import facial,speech
    face_data,_=facial();speech_data,_=speech()
    # Use first training example exactly, including the original shared preprocessing.
    from backend.ml.research_inference import classify
    face_index=int(np.flatnonzero(face_data['split']=='train')[0])
    speech_index=int(np.flatnonzero(speech_data['split']=='train')[0])
    face=classify('facial',face_data['x'][face_index:face_index+1])
    audio=classify('speech',speech_data['x'][speech_index:speech_index+1])
    gaze=dict(np.load(root/'gaze_cache.npz',allow_pickle=False))
    ix=int(np.flatnonzero(gaze['split']=='train')[0]);person=gaze['group'][ix]
    eye=infer({'schema':GAZE_SCHEMA,'provenance':'permitted_research_recording','windows':gaze['x'][gaze['group']==person].tolist()})
    if face['output'] is None or audio['output'] is None:raise RuntimeError('Example inference unavailable')
    basis=score_questionnaire('adult',{f'A{i}':'Definitely agree' for i in range(1,11)})
    record={'id':'RECORDED-RESEARCH-EXAMPLE-v1','category':'adult','created_at':datetime.now(timezone.utc).isoformat(),
        'questionnaire_basis':basis,'interpretation':'Synthetic questionnaire answers only; these separate research examples do not describe one person.',
        'modality_states':[questionnaire_state(basis,None),state(face),state(audio),eye]}
    report=build_report(record)
    report['provenance']='Recorded research example: independent V_Expression CC BY 4.0, RAVDESS CC BY-NC-SA 4.0 and Cilia Figshare CC BY 4.0 development fixtures. Real frozen inference from cached training-schema inputs; not live capture, not held-out evaluation, not aligned participants. Questionnaire answers synthetic. See MODEL_TRAINING_PROTOCOL and MULTIMODAL_TRAINING_REPORT for source versions, licences, preprocessing and hashes.'
    report['summary'].insert(0,'No raw participant media or identifying metadata is included. Speech uses a source 4-second model chunk, not the live 5-second acoustic-quality workflow. Facial input uses the cached detector-processed face; original detection was verified in the training audit.')
    out=Path('backend/reports/research/recorded_demo_example.json')
    with out.open('x') as f:json.dump(report,f,indent=2,allow_nan=False)
    print('Saved explicit aggregate example:',out)

if __name__=='__main__':main()
