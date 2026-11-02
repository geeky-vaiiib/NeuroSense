import copy
from concurrent.futures import ThreadPoolExecutor
import pytest
from backend.tests.conftest import screening_body


def login(c, email='retry@example.com'):
    assert c.post('/auth/register', json=dict(name='R', email=email, password='correct-horse-9')).status_code == 201


@pytest.mark.parametrize('category,age', [('child', 8), ('adult', 30), ('toddler', 1)])
def test_identical_retries_return_original_case_and_provenance(app_client, mongo, category, age):
    c=app_client(); login(c)
    body=screening_body(6, category, age)
    if category == 'toddler':
        body['demo']['ageMonths']=20
        body['answers']={f'Q{i}': 'A' for i in range(1,11)}
    headers={'Idempotency-Key':'reproducible-retry-001'}
    a=c.post('/screening/screen',json=body,headers=headers)
    assert a.status_code==200, a.text
    b=c.post('/screening/screen',json=body,headers=headers)
    assert a.json()==b.json()
    assert mongo.cases.count_documents({})==1
    changed=copy.deepcopy(body); changed['demo']['subjectName']='changed'
    assert c.post('/screening/screen',json=changed,headers=headers).status_code==409
    other=app_client(); login(other,'other@example.com')
    assert other.post('/screening/screen',json=body,headers=headers).json()['caseId']!=a.json()['caseId']


def test_atomic_concurrent_case_insertion(mongo):
    from backend.core import submissions
    record=dict(id='NS-C-race', user_id='owner', category='child', age=8)
    def save(i):
        return submissions.save({**record, 'id':f'NS-C-race{i}'}, {'caseId':str(i)}, 'atomic-key-123456', 'digest')
    with ThreadPoolExecutor(max_workers=4) as pool:
        out=list(pool.map(save,range(12)))
    assert all(r==out[0] for r in out)
    assert mongo.cases.count_documents({})==1
