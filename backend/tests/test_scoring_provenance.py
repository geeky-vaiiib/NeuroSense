import json
from pathlib import Path
import pytest
from backend.ml.questionnaire_score import score_questionnaire
from backend.tests.conftest import answers_scoring, screening_body


@pytest.mark.parametrize('category', ['child','adult'])
@pytest.mark.parametrize('total,meets', [(0,False),(5,False),(6,True),(7,True),(10,True)])
def test_arc_cutoff_examples(category,total,meets):
    b=score_questionnaire(category,answers_scoring(total,category))
    assert b['total_score']==total and b['threshold']==6 and b['meets_threshold']==meets
    assert b['scoring_version']==3 and b['source'].startswith('https://docs.autismresearchcentre.com/')


def test_v2_case_retains_original_basis_in_case_and_explanation(app_client,mongo):
    c=app_client(); c.post('/auth/register',json=dict(name='H',email='history@example.com',password='correct-horse-9'))
    d=c.post('/screening/screen',json=screening_body(6)).json(); cid=d['caseId']
    old={**d['questionnaireBasis'], 'scoring_version':2,'threshold':7,'meets_threshold':False,'risk_band':'Moderate','threshold_source':'dataset label rule'}
    mongo.cases.update_one({'id':cid},{'$set':{'scoring_version':2,'questionnaire_basis':old,'risk_level':'Moderate'}})
    assert c.get(f'/cases/{cid}').json()['questionnaire_basis']==old
    assert c.get(f'/explain/{cid}').json()['scoreExplanation']==old


def test_aq_display_config_matches_backend():
    root=Path(__file__).resolve().parents[2]
    assert json.loads((root/'src/data/aq10.config.json').read_text())==json.loads((root/'backend/ml/aq10_content.json').read_text())


def test_incomplete_historical_record_does_not_invent_zero_or_low_result(app_client,mongo):
    c=app_client(); u=c.post('/auth/register',json=dict(name='H',email='incomplete@example.com',password='correct-horse-9')).json()['user']
    mongo.cases.insert_one({'id':'incomplete','category':'child','age':8,'user_id':u['user_id']})
    d=c.get('/cases/incomplete').json()
    assert d['aq10Score'] is None and d['riskLevel'] is None
    assert d['resultStatus']=='unavailable' and d['riskScore'] is None
    assert 'unavailable' in d['interpretation'].lower()
