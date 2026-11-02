"""Finite regression fixtures for the documented artifact-compatible runtime."""
import json
from pathlib import Path
import pytest
from backend.ml.model import load_models, predict
from backend.tests.conftest import answers_scoring

@pytest.mark.parametrize('category',['child','adult'])
def test_pinned_runtime_reproduces_unchanged_questionnaire_artifacts(category):
    expected=json.loads((Path(__file__).resolve().parents[2]/'docs/evidence/questionnaire_runtime.json').read_text())[category]
    bundle=load_models()[category]
    assert bundle['model'] is not None, bundle['reason']
    for total, value in enumerate(expected['probabilities']):
        output=predict(category,bundle,{'age':8 if category=='child' else 30,'gender':'Male','jaundice':'No','familyAsd':'No','ethnicity':'Other'},answers_scoring(total,category))
        assert output['probability']==round(value,4)
