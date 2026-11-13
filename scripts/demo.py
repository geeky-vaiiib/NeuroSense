"""Disposable localhost demo. No production URI or authentication bypass is used."""
import argparse
import hashlib
import json
import importlib.metadata
import re
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
# Direct script execution puts scripts/, not the repository, on sys.path.
# PYTHONPATH in environment() applies to child processes only.
sys.path.insert(0, str(ROOT))

def environment(spool):
    env=os.environ.copy()
    env.update(MONGODB_URI='mongomock://academic-demo',MONGODB_DB_NAME='neurosense_disposable_demo',
        JWT_SECRET=secrets.token_urlsafe(48),COOKIE_SECURE='false',COOKIE_SAMESITE='lax',
        CORS_ALLOWED_ORIGINS='http://127.0.0.1:5173',GAZE_WARMUP='0',NS_RECORDING_TMP_DIR=spool,
        OMP_NUM_THREADS='2',MKL_NUM_THREADS='2',NUMBA_CACHE_DIR=str(Path(spool)/'numba'),VITE_API_URL='http://127.0.0.1:8000',PYTHONPATH=str(ROOT))
    return env

def preflight(without_webcam=False):
    # Explicit overrides precede application imports/dotenv and apply to child processes.
    if os.environ.get('MONGODB_URI') != 'mongomock://academic-demo':
        raise RuntimeError('Refusing non-disposable demo database')
    try:
        import ctypes.util, aifc, wave, subprocess
    except ImportError as exc:
        raise SystemExit('Incomplete Python standard library: recreate the environment using a persistent Python 3.11.14 installation, then restart the backend. ' + str(exc))
    import torch
    torch.set_num_threads(2)
    from backend.core.config import load_settings
    load_settings()
    failures=[]
    from packaging.requirements import Requirement
    if sys.version_info[:3] != (3,11,14): failures.append('Use locked Python 3.11.14')
    for line in (ROOT/'backend/requirements.lock').read_text().splitlines():
        if not re.match(r'^[A-Za-z0-9_.-]+==', line): continue
        requirement=Requirement(line.rstrip(' \\'))
        if requirement.marker and not requirement.marker.evaluate(): continue
        try: installed=importlib.metadata.version(requirement.name)
        except importlib.metadata.PackageNotFoundError: installed=None
        if installed is None or not requirement.specifier.contains(installed):
            failures.append(f'Locked dependency mismatch: {requirement.name}; install backend/requirements.lock')
    if not failures: print('PASS Python and all applicable hash-lock dependency versions')
    manifest=json.loads((ROOT/'backend/models/demo_manifest.json').read_text())
    for relative, expected in manifest.items():
        p=ROOT/relative
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:failures.append('Model hash mismatch/missing: '+relative)
    if failures:
        for failure in failures: print('FAIL', failure)
        raise SystemExit(1)
    print('PASS pinned model, metadata, encoder and background hashes')
    from backend.ml.model import load_models, predict
    from backend.ml.preprocessor import feature_names_for
    from backend.ml.questionnaire_score import score_questionnaire
    answers={f'A{i}':'Definitely agree' for i in range(1,11)}
    registry=load_models()
    for category in ('child','adult'):
        clf=registry[category]['model']
        if clf is not None and (list(clf.classes_) != [0,1] or clf.n_features_in_ != len(feature_names_for(category))):
            failures.append(category+' feature/class-order contract mismatch')
        result=predict(category,registry[category],{'age':8 if category=='child' else 30,'gender':'Male','ethnicity':'White-European','jaundice':'No','familyAsd':'No'},answers)
        if result is None:failures.append(category+' questionnaire model unavailable')
        else:print('PASS',category,'questionnaire scoring / supplementary inference',score_questionnaire(category,answers)['total_score'])
    from backend.ml.toddler_service import analyze
    toddler=analyze({f'Q{i}':'A' for i in range(1,11)},20,False)
    if not toddler['model'].get('available'):failures.append('Toddler cohort model unavailable')
    else:print('PASS toddler questionnaire and supplementary cohort inference')
    from backend.ml.research_inference import classify
    import numpy as np
    for task,shape in [('facial',(1,1,64,64)),('speech',(1,1,64,126))]:
        if classify(task,np.zeros(shape,np.float32))['output'] is None:failures.append(task+' CNN unavailable')
        else:print('PASS',task,'CNN numeric-boundary inference (not media validation)')
    from backend.ml.eye_tracker_research import infer
    from backend.ml.research_models import GAZE_SCHEMA
    x=np.random.default_rng(5).normal(0,100,(1,80,2));x-=x.mean(1,keepdims=True)
    infer({'schema':GAZE_SCHEMA,'provenance':'synthetic_numeric_engineering_fixture','windows':x.tolist()})
    print('PASS eye-tracker frozen inference; numeric engineering fixture, separate schema')
    from backend.ml.gaze.service import get_gaze_service
    from backend.ml.gaze.inference import predict_windows
    gaze=get_gaze_service()
    if not gaze.available:failures.append('Webcam gaze checkpoint unavailable')
    else:
        windows=np.zeros((1,gaze.cfg.window_steps,len(gaze.cfg.feature_names)),np.float32)
        scores=predict_windows(gaze.model,windows,gaze.meta['normalization'])
        if not np.isfinite(scores).all():failures.append('Webcam numeric inference nonfinite')
        print('PASS webcam checkpoint numeric forward pass; quality/domain gates NOT tested by this call')
    for tool in ('ffmpeg','ffprobe'):
        if not shutil.which(tool):failures.append('Install '+tool+' on PATH')
        else:print('PASS',subprocess.check_output([tool,'-version'],text=True).splitlines()[0])
    if not without_webcam and not failures:
        from backend.ml.gaze.openface import extract_from_video
        with tempfile.TemporaryDirectory(prefix='ns-demo-preflight-') as folder:
            clip=Path(folder)/'blank.webm'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=gray:s=160x120:r=15:d=2','-c:v','libvpx',str(clip)],check=True)
            try:
                frames,info=extract_from_video(clip,2.)
                print('PASS FFprobe/OpenFace execution on blank clip:',len(frames),'rows; NOT usable-face evidence')
            except Exception as exc:failures.append('OpenFace execution failed: '+str(exc)+'; configure OPENFACE_BIN or a working OPENFACE_DOCKER_IMAGE. Use --without-webcam only for explicitly reduced demo.')
    if without_webcam:print('NOT RUN OpenFace execution: explicitly selected --without-webcam profile')
    if failures:
        for failure in failures:print('FAIL',failure)
        raise SystemExit(1)
    print('PASS preflight; database is disposable in-memory, cookie hostname is 127.0.0.1. Camera permissions remain operator-controlled.')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--preflight-only',action='store_true');parser.add_argument('--without-webcam',action='store_true')
    args=parser.parse_args();os.chdir(ROOT)
    with tempfile.TemporaryDirectory(prefix='neurosense-demo-') as spool:
        os.environ.update(environment(spool));preflight(args.without_webcam)
        if args.preflight_only:return
        for port in (8000, 5173):
            with socket.socket() as probe:
                try: probe.bind(('127.0.0.1', port))
                except OSError as exc: raise RuntimeError(f'Port {port} is occupied; stop the conflicting local service before starting the demo.') from exc
        processes=[]
        try:
            processes.append(subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000']))
            for _ in range(60):
                if processes[0].poll() is not None:raise RuntimeError('Backend exited; check port 8000 and startup log')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:8000/ready',timeout=1) as r:
                        if r.status==200:break
                except OSError:time.sleep(.5)
            else:raise RuntimeError('Backend readiness timeout')
            processes.append(subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port','5173','--strictPort']))
            for _ in range(60):
                if processes[1].poll() is not None: raise RuntimeError('Frontend exited; check port 5173 and npm dependencies')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:5173', timeout=1) as response:
                        if response.status == 200: break
                except OSError: time.sleep(.5)
            else: raise RuntimeError('Frontend connectivity timeout')
            print('PASS frontend/backend localhost connectivity', flush=True)
            print('\nOpen http://127.0.0.1:5173 — register a disposable account. Data disappears on exit. Ctrl-C stops both services.\n',flush=True)
            while all(p.poll() is None for p in processes):time.sleep(.5)
            raise RuntimeError('A demo service exited; inspect logs/port availability')
        except KeyboardInterrupt:pass
        finally:
            for p in processes:
                if p.poll() is None:p.terminate()
            for p in processes:
                try:p.wait(timeout=15)
                except subprocess.TimeoutExpired:p.kill();p.wait()

if __name__=='__main__':main()
