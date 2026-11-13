"""Toddler-only policy regressions; numeric boundaries are not participant validation."""
from backend.ml.toddler_recordings import ToddlerGazeMeasurements, analyze_toddler_speech
from backend.tests.test_gaze_openface import synth
from backend.tests.test_speech_facial import _wav_b64


def test_toddler_gaze_has_no_learned_model_or_source_domain(monkeypatch):
    from backend.ml.gaze import model,quality
    monkeypatch.setattr(model,'load_checkpoint',lambda *a,**k:(_ for _ in ()).throw(AssertionError('child model loaded')))
    monkeypatch.setattr(quality,'domain_check',lambda *a,**k:(_ for _ in ()).throw(AssertionError('child domain used')))
    result=ToddlerGazeMeasurements().analyze_frames(synth())
    assert result['quality']['valid'] and result['descriptive']['channels']
    assert result['probability'] is None and result['input_population']=='toddler'
    assert result['model_version']=='toddler-measurements-v1'


def test_toddler_acoustics_never_load_a_classifier(monkeypatch):
    from backend.ml import speech_engine
    monkeypatch.setattr(speech_engine,'load_classifier',lambda *a:(_ for _ in ()).throw(AssertionError('ASD model loaded')))
    result=analyze_toddler_speech(_wav_b64(),'audio/wav')
    assert result['features']['pitch_mean']>0 and result['output'] is None
    assert 'toddler' in result['reason']


def test_toddler_recordings_persist_without_borrowed_predictions(app_client,monkeypatch):
    import numpy as np
    from backend.ml.gaze import jobs
    from backend.ml import research_inference as research, facial_engine as face
    from backend.tests.test_speech_facial import _png_b64
    from backend.tests.conftest import screening_body
    result=ToddlerGazeMeasurements().analyze_frames(synth())
    monkeypatch.setattr(jobs,'result_for',lambda *a:result)
    monkeypatch.setattr(research,'classify',lambda *a:(_ for _ in ()).throw(AssertionError('borrowed CNN')))
    monkeypatch.setattr(face._cv,'_detect_face',lambda *a:((0,0,64,64),'haar_frontalface'))
    monkeypatch.setattr(face._cv,'_detect_haar',lambda *a,**k:[(0,0,64,64)])
    client=app_client();client.post('/auth/register',json={'name':'QA','email':'toddler-recordings@example.com','password':'local-fixture-password-99'})
    body=screening_body(category='toddler',age=2,answers={f'Q{i}':'A' for i in range(1,11)},
        gazeSkipped=False,gazeAnalysisId='toddler-job',speechSkipped=False,audioBase64=_wav_b64(),audioMimeType='audio/wav',
        facialSkipped=False,facialImageBase64=_png_b64(np.random.default_rng(1).integers(30,220,(64,64,3),dtype=np.uint8)))
    body['demo']['ageMonths']=20
    response=client.post('/screening/screen',json=body);assert response.status_code==200,response.text
    saved=response.json()['report'];assert saved==client.get('/cases/'+response.json()['caseId']).json()['display_report']
    for card in saved['presentation']['recordings']:
        assert card['analysis']['measurement_status']=='available'
        assert card['analysis']['output'] is None
    result['input_population']='adult'
    assert client.post('/screening/screen',json=body).status_code==422


def test_toddler_capability_does_not_construct_child_service(app_client,monkeypatch):
    from backend.routers import gaze
    monkeypatch.setattr(gaze,'get_gaze_service',lambda:(_ for _ in ()).throw(AssertionError('child/adult service constructed')))
    c=app_client();c.post('/auth/register',json={'name':'QA','email':'toddler-status@example.com','password':'fixture-password-99'})
    response=c.get('/gaze/status?population=toddler')
    assert response.status_code==200 and response.json()['model_version']=='toddler-measurements-v1'


def test_expired_toddler_job_retains_population_and_has_valid_poll_response(mongo):
    import time
    from backend.ml.gaze import jobs
    from backend.schemas.gaze import GazeJobStatus
    now=time.time()
    jobs._persist({'id':'expired-toddler','user_id':'owner','owner_token':'token','state':'processing',
                   'created':now-100,'lease_until':now-1,'deadline':now+100,'population':'toddler'})
    polled=jobs.get('expired-toddler','owner')
    GazeJobStatus(job_id=polled['id'],state=polled['state'],stage=polled['stage'],result=polled['result'])
    result=jobs.result_for('expired-toddler','owner')
    assert result['input_population']=='toddler' and result['probability'] is None
    assert result['reason']=='interrupted'
