"""Private permitted-media integration smoke, NOT a live-session or validation study.

Requires existing licensed V_Expression/RAVDESS archives, extracted media and training
caches. No download/training/DASD access. Writes aggregate reports only to an explicit
private output path; never joins the separate source people into one case.
Run: OMP_NUM_THREADS=2 .venv-demo/bin/python scripts/verify_recording_fixtures.py /tmp/ns-fixture-reports.json
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    destination = Path(sys.argv[1]).resolve()
    if destination.exists():
        raise SystemExit('Refusing to overwrite an existing fixture report.')
    os.environ.update(MONGODB_URI='mongomock://fixture-verification', MONGODB_DB_NAME='fixture_verification',
                      JWT_SECRET=__import__('secrets').token_urlsafe(48), COOKIE_SECURE='false', GAZE_WARMUP='0')
    import numpy as np
    import soundfile as sf
    import torch
    from fastapi.testclient import TestClient
    from backend.data.download_research_data import SOURCES
    from backend.main import app
    from backend.core.database import get_db
    torch.set_num_threads(2)
    data = ROOT / 'research-data'
    for task in ('speech', 'facial'):
        _, name, algorithm, expected, *_ = SOURCES[task]
        if hashlib.new(algorithm, (data/'downloads'/name).read_bytes()).hexdigest() != expected:
            raise RuntimeError(f'{task} licensed archive does not match recorded source checksum')
    audio = np.load(data/'speech_cache.npz', allow_pickle=False)
    paths = {p.stem:p for p in (data/'ravdess').rglob('*.wav')}
    # First training recording meeting the existing duration rule, never selected by prediction.
    speech = next((paths[str(audio['sample'][i])] for i in np.flatnonzero(audio['split']=='train')
                   if sf.info(paths[str(audio['sample'][i])]).duration >= 5), None)
    if speech is None:
        raise RuntimeError('No training recording meets the five-second live input requirement.')
    face = np.load(data/'facial_cache.npz', allow_pickle=False)
    index = np.flatnonzero(face['split']=='train')[0]
    image = next((data/'facial').rglob('images.csv')).parent / str(face['sample'][index])
    reports = {}
    with TestClient(app, headers={'X-Requested-With':'NeuroSense'}) as client:
        response = client.post('/auth/register', json={'name':'Permitted fixture QA','email':'fixture@example.com',
                                                      'password':__import__('secrets').token_urlsafe(32)})
        assert response.status_code == 201, response.status_code
        for task, path in [('speech',speech),('facial',image)]:
            body = {'category':'adult', 'demo':{'subjectName':'Synthetic questionnaire / separate permitted media',
                    'respondentName':'Technical QA','age':30,'gender':'Male','jaundice':'No','familyAsd':'No'},
                    'answers':{f'A{i}':'Definitely agree' for i in range(1,11)},
                    'gazeSkipped':True,'speechSkipped':True,'facialSkipped':True}
            payload = base64.b64encode(path.read_bytes()).decode()
            body.update({'audioBase64':payload,'audioMimeType':'audio/wav','speechSkipped':False} if task=='speech' else
                        {'facialImageBase64':payload,'facialSkipped':False})
            response = client.post('/screening/screen',json=body)
            assert response.status_code == 200, response.status_code
            result = response.json()
            saved = get_db().cases.find_one({'id':result['caseId']})['report']
            assert saved == result['report'] == client.get('/cases/'+result['caseId']).json()['display_report']
            model = next(m for m in saved['modalities'] if m['id']==('speech_emotion' if task=='speech' else 'facial_expression'))
            assert model['output'] is not None, model['inclusion_reason']
            reports[task] = saved
            print(f'PASS {task}: actual permitted-media inference, saved/reopened agreement; NOT physical hardware')
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps({'scope':'Separate permitted training-media inputs with synthetic questionnaire answers; not one person or live capture',
                                     'reports':reports},indent=2))


if __name__ == '__main__':
    main()
