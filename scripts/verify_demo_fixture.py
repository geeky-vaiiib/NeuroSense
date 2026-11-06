"""Permitted-media API smoke in disposable storage; never a webcam or accuracy claim.
Inputs must already be authorized/local. Output contains aggregate statuses only.
"""
import argparse,base64,json,os,secrets,tempfile
from pathlib import Path

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--image',type=Path,required=True);p.add_argument('--audio',type=Path,required=True);p.add_argument('--evidence',type=Path,required=True)
    a=p.parse_args()
    with tempfile.TemporaryDirectory(prefix='ns-demo-fixture-') as spool:
        os.environ.update(MONGODB_URI='mongomock://demo-fixture',MONGODB_DB_NAME='demo_fixture',JWT_SECRET=secrets.token_urlsafe(48),COOKIE_SECURE='false',CORS_ALLOWED_ORIGINS='http://127.0.0.1:5173',GAZE_WARMUP='0',NS_RECORDING_TMP_DIR=spool,NUMBA_CACHE_DIR='/tmp/neurosense-numba',OMP_NUM_THREADS='2')
        import torch
        torch.set_num_threads(2)
        from fastapi.testclient import TestClient
        from backend.main import app
        from backend.ml.research_inference import speech_emotion
        import librosa
        body={'category':'adult','demo':{'age':30,'gender':'Prefer not to say','subjectName':'Technical fixture, not source demographics'},
            'answers':{f'A{i}':'Definitely agree' for i in range(1,11)},'gazeSkipped':True,'speechSkipped':False,'facialSkipped':False,
            'audioBase64':base64.b64encode(a.audio.read_bytes()).decode(),'audioMimeType':'audio/wav','facialImageBase64':base64.b64encode(a.image.read_bytes()).decode()}
        with TestClient(app,headers={'X-Requested-With':'NeuroSense'}) as c:
            c.post('/auth/register',json={'name':'Technical fixture','email':'demo-fixture@example.invalid','password':secrets.token_urlsafe(24)})
            r=c.post('/screening/screen',json=body,headers={'Idempotency-Key':'licensed-demo-fixture-1'});r.raise_for_status();result=r.json()
            repeat=c.post('/screening/screen',json=body,headers={'Idempotency-Key':'licensed-demo-fixture-1'}).json()
            saved=c.get('/cases/'+result['caseId']).json()
            assert saved['report']==result['report']==repeat['report']
            assert result['result']['modalities_in_result']==['questionnaire']
            cards={m['id']:m for m in saved['report']['modalities']}
            assert cards['facial_expression']['status']=='available_experimental'
            wave,sr=librosa.load(a.audio,sr=16000,mono=True);direct=speech_emotion(wave,sr)
            assert direct['status']=='available_experimental'
            if len(wave)/sr<5:assert cards['speech_emotion']['output'] is None
            evidence={'scope':'Permitted source-media TestClient smoke; technical age routing fixture, not participant demographics or hardware validation',
                'api_saved_retry_report_equal':True,'questionnaire_only':True,'raw_spool_empty':not list(Path(spool).iterdir()),
                'source_audio_duration_s':len(wave)/sr,'speech_direct_status':direct['status'],
                'modality_statuses':{k:v['status'] for k,v in cards.items()},'physical_webcam':'NOT RUN'}
            with a.evidence.open('x') as f:json.dump(evidence,f,indent=2)
            print(json.dumps(evidence,indent=2))

if __name__=='__main__':main()
