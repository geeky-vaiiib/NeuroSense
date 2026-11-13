"""Saved-value presentation regressions. No new scoring or participant evaluation."""
from copy import deepcopy
import pytest
from backend.core.report_presentation import present
from backend.core.reports import build_report
from backend.tests.conftest import screening_body

@pytest.mark.parametrize('flag,expected',[(True,'At or above'),(False,'Below'),(None,'Original outcome')])
def test_outcome_uses_saved_flag_not_numbers_or_free_text(flag,expected):
    report={'questionnaire':{'total_score':99,'max_score':100,'threshold':1,'meets_threshold':flag},'modalities':[]}
    before=deepcopy(report);p=present(report)['presentation']
    assert p['outcome'].startswith(expected) and report==before
    assert p['score_text']=='99 / 100' and len(p['recordings'])==3

@pytest.mark.parametrize('status,expected',[('skipped','Skipped'),('failed_quality','Recording needs another attempt'),('analysis_failed','Could not analyse'),('not_provided','Could not analyse')])
def test_plain_recording_failure_states(status,expected):
    r=present({'modalities':[{'id':'speech','status':status}]})
    assert r['presentation']['recordings'][1]['status']==expected


def test_measurements_and_classification_are_distinct_and_domain_rejection_is_honest():
    r=present({'modalities':[{'id':'speech','status':'measurements_available','measurements':{'pitch_mean':123}},
      {'id':'speech_emotion','status':'model_unavailable','output':None},
      {'id':'gaze','status':'failed_quality','measurements':{'domain':{'status':'out_of_domain'}}}]})
    voice=r['presentation']['recordings'][1]
    assert voice['status']=='Measurements available; model result unavailable' and 'No research classification' in voice['summary']
    assert 'outside the model' in r['presentation']['recordings'][0]['summary']
    assert r['presentation']['recordings'][0]['status']=='Could not analyse'


def test_new_report_is_saved_and_old_report_adapted_without_rewrite(app_client,mongo):
    c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'plain@example.com','password':'fixture-password-9'})
    response=c.post('/screening/screen',json=screening_body()).json();rid=response['caseId']
    saved=mongo.cases.find_one({'id':rid})
    assert response['report']==saved['report']==c.get('/cases/'+rid).json()['display_report']
    assert saved['report']['report_version']=='research-report-v3'
    old=deepcopy(saved['report']);old.pop('presentation');old['report_version']='research-report-v1'
    mongo.cases.update_one({'id':rid},{'$set':{'report':old}})
    detail=c.get('/cases/'+rid).json()
    assert {k:v for k,v in detail['report'].items() if k!='presentation'}==old and detail['display_report']['presentation']['version']=='plain-language-v1'
    assert mongo.cases.find_one({'id':rid})['report']==old
    mongo.cases.update_one({'id':rid},{'$unset':{'report':''}})
    legacy=c.get('/cases/'+rid).json()
    assert legacy['report'] is None and legacy['display_report']['presentation']['score_text']=='8 / 10'


def test_cached_example_does_not_claim_unperformed_measurements_or_missing_eye_output():
    r=present({'modalities':[{'id':'eye_tracker','status':'available_experimental','output':{'value':.4}},
      {'id':'speech_emotion','status':'available_experimental','output':{'label':'calm'}}]},example=True)
    eye,voice,_=r['presentation']['recordings']
    assert eye['status']=='Analysed' and eye['label']=='Eye-tracker research example'
    assert 'classified the supplied audio' in voice['summary'] and 'measurements were taken' not in voice['summary']


def test_shared_frontend_qa_contract_matches_backend_assembler():
    import runpy,json
    from pathlib import Path
    root=Path(__file__).resolve().parents[2]
    build=runpy.run_path(str(root/'scripts/export_results_qa.py'))['build']
    assert json.loads((root/'src/test/fixtures/resultsReports.json').read_text())==build()


def test_partial_historical_basis_does_not_invent_missing_score_or_contradict_saved_basis():
    report=build_report({'id':'old','created_at':'2020','category':'adult','questionnaire_basis':{'instrument':'AQ-10','scoring_version':2}})
    assert report['presentation']['score_text']=='Unavailable'
    assert report['presentation']['outcome']=='Original outcome retained'
    assert report['modalities'][0]['status']=='available_scoring_instrument'
    assert report['modalities'][0]['output']['total'] is None


def test_legacy_total_is_retained_without_inventing_a_maximum_or_threshold():
    r=build_report({'id':'old','created_at':'2020','category':'adult','aq10_score':8})
    assert r['presentation']['score_text']=='8 points (original maximum unavailable)'
    assert r['presentation']['threshold_text']=='Original threshold unavailable'
    assert r['presentation']['outcome']=='Original outcome retained'


def test_gaze_quality_pass_domain_rejection_retains_measurements_and_null_output():
    from backend.ml.modality_status import gaze_state
    s = gaze_state({'status':'out_of_domain', 'reason':'motion_outside_training_range',
        'quality':{'valid':True}, 'descriptive':{'channels':{'gaze_x':{'std_deg':2.5}}},
        'domain':{'status':'out_of_domain'}, 'probability':None},False,None)
    r = build_report({'id':'numeric-boundary','created_at':'2026','category':'adult','modality_states':[s]})
    card = r['presentation']['recordings'][0]
    assert card['status']=='Measurements available; model result unavailable'
    assert card['analysis']['quality_status']=='passed'
    assert card['analysis']['classification_status']=='withheld'
    assert card['analysis']['output'] is None
    assert 'Your recording was processed.' in card['summary']
    assert r['modalities'][2]['measurements']['descriptive']['channels']['gaze_x']['std_deg']==2.5


def test_failed_emotion_reason_reaches_saved_presentation_without_dropping_acoustics():
    r=present({'modalities':[{'id':'speech','status':'measurements_available','measurements':{'pitch_mean':123}},
        {'id':'speech_emotion','status':'analysis_failed','reason':'Emotion preprocessing failed.','output':None}]})
    c=r['presentation']['recordings'][1]
    assert c['analysis']['measurement_status']=='available'
    assert c['analysis']['classification_status']=='failed'
    assert 'Emotion preprocessing failed.' in c['summary']
    assert c['analysis']['output'] is None


def test_recording_contract_output_survives_api_storage_and_reopen(app_client,mongo,monkeypatch):
    """Controlled processors, real request/state/storage projection. No hardware claim."""
    from backend.ml import preprocessing_pipeline as preprocessor
    from backend.tests.conftest import screening_body
    output={'kind':'speech_emotion','label':'calm','class_scores':{'calm':.7,'happy':.3},'calibrated':False}
    candidate={'task':'speech_emotion','status':'available_experimental','output':output,
               'model':{'version':'engineering-boundary','weights_sha256':'fixture-only'},'reason':'Separate task'}
    monkeypatch.setattr(preprocessor,'analyze_speech',lambda *a,**k:{'status':'model_unavailable','features':{'pitch_mean':120.125},'emotion_result':candidate})
    c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'stages@example.com','password':'fixture-password-9'})
    body=screening_body(category='adult',age=30,audioBase64='controlled-boundary',speechSkipped=False)
    response=c.post('/screening/screen',json=body)
    assert response.status_code==200,response.text
    r=response.json();saved=mongo.cases.find_one({'id':r['caseId']})['report']
    assert r['report']==saved==c.get('/cases/'+r['caseId']).json()['display_report']
    stage=saved['presentation']['recordings'][1]['analysis']
    assert stage['output']==output and stage['measurement_status']=='available'


def test_incompatible_checkpoint_hash_is_not_evidence_of_model_availability():
    from backend.core.recording_contract import recording_analysis
    state={'status':'model_unavailable','model':{'weights_sha256':'hash-of-incompatible-artifact'},
           'quality':{'valid':True},'measurements':{'descriptive':{'channels':{'gaze_x':{'std_deg':1}}}}}
    stages=recording_analysis('gaze',state,state)
    assert stages['model_status']=='unavailable'
    assert stages['measurement_status']=='available' and stages['output'] is None


def test_decoding_failure_has_specific_reason_and_service_retry_action():
    reason='The server could not decode the recording. Check the server audio runtime and FFmpeg installation before trying again.'
    report=present({'modalities':[{'id':'speech','status':'analysis_failed','reason':reason},
                                 {'id':'speech_emotion','status':'analysis_failed','reason':reason}]})
    voice=report['presentation']['recordings'][1]
    assert reason in voice['summary']
    assert voice['analysis']['classification_status']=='failed'
    assert 'operator' in voice['analysis']['retry_action']
