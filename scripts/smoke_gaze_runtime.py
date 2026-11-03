"""Explicit synthetic blank-video smoke; real FFmpeg/OpenFace, mongomock only.
Run from repository root: PYTHONPATH=. python scripts/smoke_gaze_runtime.py
Writes only /tmp/ns-gaze-real-* and /tmp/neurosense-real-gaze.json.
No participant recording is used and no quality gate is bypassed.
"""
import os
os.environ.update(MONGODB_URI='mongomock://gaze-smoke',GAZE_WARMUP='0',OPENFACE_DOCKER_IMAGE='algebr/openface',NS_RECORDING_TMP_DIR='/tmp/ns-gaze-real-spool')
import json,subprocess,hashlib,time,platform,sys
from pathlib import Path
import mongomock
from backend.core import database
from backend.ml.gaze import jobs
from backend.ml.gaze.service import get_gaze_service
root=Path('/tmp/ns-gaze-real-fixtures');root.mkdir(exist_ok=True)
database._db=mongomock.MongoClient().smoke
rows=[]
for suffix,codec in [('webm','libvpx'),('mp4','libx264')]:
    video=root/f'blank.{suffix}'
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=gray:s=320x240:r=15:d=30','-c:v',codec,str(video)],check=True)
    path=Path(os.environ['NS_RECORDING_TMP_DIR']);path.mkdir(exist_ok=True)
    raw=path/f'ns_upload_fixture.{suffix}';raw.write_bytes(video.read_bytes())
    start=time.time();jobs._persist(dict(id=suffix,user_id='fixture',owner_token='smoke',created=start,lease_until=start+60,deadline=start+900,state='processing',stage='uploaded',result=None))
    jobs._run(suffix,'smoke',raw,30.,'synthetic-blank')
    result=jobs.get(suffix,'fixture')['result']
    rows.append({'fixture':suffix,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'result':result,'raw_deleted':not raw.exists(),'spool_empty':not list(path.iterdir())})
out={'os':platform.platform(),'python':sys.version,'image_digest':subprocess.check_output(['docker','image','inspect','algebr/openface','--format','{{.Id}}'],text=True).strip(),'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],'model_version':get_gaze_service().model_version,'model_loaded':get_gaze_service().available,'model_sha256':hashlib.sha256(Path('backend/models/gaze_openface_dasd_v3.pt').read_bytes()).hexdigest(),'runs':rows}
Path('/tmp/neurosense-real-gaze.json').write_text(json.dumps(out,indent=2))
print(json.dumps({'runs':[{k:v for k,v in r.items() if k!='result'}|{'status':r['result']['status'],'reason':r['result'].get('reason'),'timings':r['result'].get('timings_s')} for r in rows]},indent=2))
