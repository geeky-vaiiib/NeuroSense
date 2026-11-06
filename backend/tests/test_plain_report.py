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
    assert voice['status']=='Analysed' and 'No research classification' in voice['summary']
    assert 'outside the model' in r['presentation']['recordings'][0]['summary']
    assert r['presentation']['recordings'][0]['status']=='Could not analyse'


def test_new_report_is_saved_and_old_report_adapted_without_rewrite(app_client,mongo):
    c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'plain@example.com','password':'fixture-password-9'})
    response=c.post('/screening/screen',json=screening_body()).json();rid=response['caseId']
    saved=mongo.cases.find_one({'id':rid})
    assert response['report']==saved['report']==c.get('/cases/'+rid).json()['display_report']
    assert saved['report']['report_version']=='research-report-v2'
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
