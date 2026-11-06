"""Engineering contracts with disposable storage, not participant validation."""
import copy
import numpy as np
import pytest
from backend.tests.conftest import screening_body
from backend.core.reports import build_report
from backend.ml.eye_tracker_research import infer
from backend.ml.research_models import GAZE_SCHEMA


def test_report_saved_reopened_retried_and_owned(app_client, mongo):
    c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'report@example.com','password':'fixture-password-9'})
    body=screening_body(points=6,category='adult',age=30)
    headers={'Idempotency-Key':'report-fixture-key-0123456'}
    first=c.post('/screening/screen',json=body,headers=headers)
    assert first.status_code==200, first.text
    data=first.json(); report=data['report']
    assert c.post('/screening/screen',json=body,headers=headers).json()==data
    saved=c.get('/cases/'+data['caseId']).json()
    assert saved['report']==report==mongo.cases.find_one({'id':data['caseId']})['report']
    assert report['questionnaire']==data['questionnaireBasis']
    assert report['questionnaire']['threshold']==6
    for m in report['modalities']:
        assert m['included_in_screening']==(m['id']=='questionnaire')
        if m['status']=='skipped':assert m['output'] is None
    stranger=app_client();stranger.post('/auth/register',json={'name':'Other','email':'other-report@example.com','password':'fixture-password-9'})
    assert stranger.get('/cases/'+data['caseId']).status_code==404
    c.post('/auth/logout');assert c.get('/cases/'+data['caseId']).status_code==401


def test_historical_record_does_not_get_regenerated_report(app_client,mongo):
    c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'legacy-report@example.com','password':'fixture-password-9'})
    data=c.post('/screening/screen',json=screening_body()).json()
    mongo.cases.update_one({'id':data['caseId']},{'$unset':{'report':''},'$set':{'scoring_version':2,'questionnaire_basis.threshold':7}})
    old=c.get('/cases/'+data['caseId']).json()
    assert old['report'] is None and old['questionnaire_basis']['threshold']==7 and old['scoring_version']==2


def test_report_withholds_failed_outputs_preserves_precision_and_units():
    record={'id':'fixture','created_at':'2026-11-05T00:00:00Z','category':'adult','modality_states':[
        {'id':'gaze','status':'failed_quality','output':{'value':.9}},
        {'id':'speech_emotion','status':'available_experimental','output':{'label':'calm','class_scores':{'calm':.123456789}}},
        {'id':'speech','status':'model_unavailable','measurements':{'pitch_mean':180.123456}}]}
    original=copy.deepcopy(record);r=build_report(record)
    assert record==original
    gaze=next(m for m in r['modalities'] if m['id']=='gaze');assert gaze['output'] is None
    speech=next(m for m in r['modalities'] if m['id']=='speech')
    assert speech['values'][0]=={'name':'measurements.pitch_mean','value':180.123456,'unit':'Hz','text':'180.123 Hz','accessible_label':None}
    emotion=next(m for m in r['modalities'] if m['id']=='speech_emotion')
    assert emotion['output']['class_scores']['calm']==.123456789 and emotion['values'][1]['text']=='12.3%'


def test_eye_tracker_real_weights_numeric_engineering_fixture_and_schema_rejection():
    rng=np.random.default_rng(41);x=rng.normal(0,100,(2,80,2));x-=x.mean(1,keepdims=True)
    p={'schema':GAZE_SCHEMA,'provenance':'synthetic_numeric_engineering_fixture','windows':x.tolist()}
    r=infer(p)
    assert r['status']=='available_experimental' and r['output']['calibrated'] is False
    assert sum(r['output']['class_scores'].values())==pytest.approx(1)
    with pytest.raises(ValueError,match='Incompatible schema'):infer({**p,'schema':'openface-gaze-angles'})
    with pytest.raises(ValueError,match='finite windows'):infer({**p,'windows':[[[float('nan'),0]]*80]})


def test_recorded_example_is_explicit_authenticated_and_never_creates_case(app_client,mongo):
    c=app_client()
    assert c.get('/research/recorded-example').status_code==401
    c.post('/auth/register',json={'name':'Fixture','email':'example-viewer@example.com','password':'fixture-password-9'})
    r=c.get('/research/recorded-example');assert r.status_code==200,r.text
    data=r.json();assert data['provenance'].startswith('Recorded research example:')
    assert 'not aligned participants' in data['provenance']
    assert mongo.cases.count_documents({})==0
    for mid in ('facial_expression','speech_emotion','eye_tracker'):
        card=next(m for m in data['modalities'] if m['id']==mid)
        assert card['output'] is not None and card['included_in_screening'] is False


def test_api_age_bound_matches_existing_canonical_frontend_range():
    from backend.schemas.screening import ScreeningRequest
    from backend.ml.questionnaire_score import validate_age
    validate_age('adult',120)
    assert ScreeningRequest.model_validate(screening_body(category='adult',age=120)).demo.age==120
    with pytest.raises(ValueError):ScreeningRequest.model_validate(screening_body(category='adult',age=121))


def test_toddler_model_does_not_round_across_frozen_threshold(monkeypatch):
    from backend.ml import toddler_service as TS
    model=TS.TM.load_model()
    monkeypatch.setattr(model,'predict_proba',lambda x: model.threshold-0.00000001)
    r=TS.analyze({f'Q{i}':'A' for i in range(1,11)},20,False)
    assert r['model']['probability']==model.threshold-0.00000001
    assert r['model']['above_threshold'] is False
    assert r['screening']['total_score']==1


def test_demo_environment_cannot_inherit_production_database_or_secret(monkeypatch,tmp_path):
    import runpy
    from pathlib import Path
    environment=runpy.run_path(str(Path(__file__).resolve().parents[2]/'scripts/demo.py'))['environment']
    monkeypatch.setenv('MONGODB_URI','mongodb://forbidden-production.invalid')
    monkeypatch.setenv('JWT_SECRET','not-a-demo-secret')
    env=environment(str(tmp_path))
    assert env['MONGODB_URI']=='mongomock://academic-demo'
    assert env['JWT_SECRET']!='not-a-demo-secret' and len(env['JWT_SECRET'])>=32
    assert env['VITE_API_URL']=='http://127.0.0.1:8000' and env['CORS_ALLOWED_ORIGINS']=='http://127.0.0.1:5173'
