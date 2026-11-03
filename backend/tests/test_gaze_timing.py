"""Timing policy boundary tests; ffprobe output is controlled, no Docker required."""
import json
from types import SimpleNamespace
import pytest
from backend.ml.gaze import openface as OF
from backend.tests.test_gaze_openface import _make_video

@pytest.mark.parametrize('suffix',['.webm','.mp4'])
@pytest.mark.parametrize('client',[None,2.,float('nan'),-1,30.])
def test_duration_from_media_not_client(tmp_path,monkeypatch,suffix,client):
    src=tmp_path/'decoded.avi'; _make_video(src)
    renamed=tmp_path/f'input{suffix}'; src.rename(renamed) # AVI bytes; demux evidence mocked, not codec coverage
    monkeypatch.setattr(OF.subprocess,'run',lambda *a,**k:SimpleNamespace(stdout=json.dumps({'frames':[{'pts_time':str(i/15)} for i in range(30)]})))
    if client is not None and (client!=2.):
        with pytest.raises(OF.CorruptVideo): OF.normalize_video(renamed,tmp_path/'out.avi',client)
    else:
        info=OF.normalize_video(renamed,tmp_path/'out.avi',client)
        assert info.duration_s==pytest.approx(2.) and info.fps==pytest.approx(15.)
        assert 'media_pts' in info.timing_source

@pytest.mark.parametrize('pts',[[0,1,1],[0,.1,2],[0,float('nan'),1],[]])
def test_unreliable_pts_rejected(tmp_path,monkeypatch,pts):
    src=tmp_path/'input.avi';_make_video(src,n=max(1,len(pts)))
    monkeypatch.setattr(OF.subprocess,'run',lambda *a,**k:SimpleNamespace(stdout=json.dumps({'frames':[{'pts_time':str(i)} for i in pts]})))
    with pytest.raises(OF.CorruptVideo):OF.normalize_video(src,tmp_path/'out.avi',None)

@pytest.mark.parametrize('suffix,codec',[('webm','libvpx'),('mp4','libx264')])
def test_real_codecs_with_server_timing(tmp_path,suffix,codec):
    import shutil,subprocess
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'): pytest.skip('real codec smoke needs FFmpeg/ffprobe')
    src=tmp_path/f'blank.{suffix}'
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','color=c=gray:s=64x48:r=15:d=2','-c:v',codec,str(src)],check=True)
    info=OF.normalize_video(src,tmp_path/'out.avi',None)
    assert info.frames==30 and info.duration_s==pytest.approx(2,abs=.05)
    assert (info.width,info.height)==(64,48)

def test_timing_provenance_persists_without_affecting_questionnaire(app_client,monkeypatch):
    from backend.routers import screening
    from backend.ml.gaze.service import get_gaze_service
    from backend.tests.conftest import screening_body
    svc=get_gaze_service(); result=svc._fail(svc._base('fixture'),'insufficient_quality','GAZE_NO_FACE','face_not_detected')
    result['recording_timing']={'duration_s':30.,'normalization_version':'media-pts-cfr-v1'}
    monkeypatch.setattr(screening.gaze_jobs,'result_for',lambda *a:result)
    c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'gaze-timing@example.com','password':'correct-horse-9'})
    response=c.post('/screening/screen',json=screening_body(6,gazeSkipped=False,gazeAnalysisId='owned-fixture')).json()
    assert response['aq10Score']==6 and response['result']['modalities_in_result']==['questionnaire']
    saved=c.get('/cases/'+response['caseId']).json()
    assert saved['gaze_features']['recording_timing']==result['recording_timing'] and saved['gaze_score'] is None
