"""Engineering fixtures only: no human recordings or diagnostic validation."""
import dataclasses,json,zipfile
from pathlib import Path
import numpy as np
import pytest
from backend.ml import research_inference as R
from backend.ml.research_models import audio_inputs,face_input,SPEECH_CLASSES,FACE_CLASSES,GAZE_SCHEMA
from backend.data.train_research_modalities import split_people,baseline
from backend.data.download_research_data import safe_extract

@pytest.fixture(autouse=True)
def clear_models():
 R.load_model.cache_clear();yield;R.load_model.cache_clear()

@pytest.mark.parametrize('task,classes,width',[('facial',FACE_CLASSES,64),('speech',SPEECH_CLASSES,126)])
def test_real_checkpoints_class_order_shapes_and_exclusion(task,classes,width):
 model,meta=R.load_model(task);assert model is not None and tuple(meta['classes'])==classes
 result=R.classify(task,np.zeros((1,1,64,width),np.float32));assert result['status']=='available_experimental'
 assert list(result['output']['class_scores'])==list(classes)
 assert sum(result['output']['class_scores'].values())==pytest.approx(1,abs=1e-5)
 assert result['output']['calibrated'] is False and R.state(result)['eligible_for_result'] is False

@pytest.mark.parametrize('task',['facial','speech'])
def test_optional_corrupt_or_incompatible_model_has_null_output(tmp_path,monkeypatch,task):
 folder=tmp_path/f'{task}-v1';folder.mkdir();(folder/'metadata.json').write_text(json.dumps({'schema':GAZE_SCHEMA}))
 monkeypatch.setattr(R,'ROOT',tmp_path)
 result=R.classify(task,np.zeros((1,1,64,64),np.float32))
 assert result['status']=='model_unavailable' and result['output'] is None

@pytest.mark.parametrize('x',[np.full((1,1,64,64),np.nan),np.zeros((1,3,64,64))])
def test_bad_model_input_never_succeeds(x):
 result=R.classify('facial',x);assert result['status']=='analysis_failed' and result['output'] is None

def test_real_preprocessing_no_face_or_silent_audio_is_withheld():
 assert face_input(np.full((128,128,3),128,np.uint8)) is None
 assert R.face_expression(np.full((128,128,3),128,np.uint8))['output'] is None
 assert R.speech_emotion(np.zeros(16000),16000)['output'] is None


def test_audio_schema_is_shared_and_does_not_mutate_wave():
 wave=(.2*np.sin(np.arange(96000)*2*np.pi*180/16000)).astype(np.float32);original=wave.copy()
 x,f=audio_inputs(wave,16000);assert x.shape[1:]==(1,64,126) and f.shape==(43,)
 np.testing.assert_array_equal(wave,original)
 assert np.isfinite(x).all() and np.isfinite(f).all()


def test_split_people_is_disjoint_stratified_and_repeatable():
 ids=[f'software-{i}' for i in range(30)];labels=[i%2 for i in range(30)];a=split_people(ids,labels)
 assert a==split_people(ids,labels) and len(a)==30
 assert set(a.values())=={'train','validation','test'}
 for split in set(a.values()):assert set(y for g,y in zip(ids,labels) if a[g]==split)=={0,1}


def test_baseline_fits_scaling_only_on_training_rows(monkeypatch):
 import backend.data.train_research_modalities as T
 d={'x':np.zeros((6,1,64,64)),'y':np.array([0,1,0,1,0,1]),'split':np.array(['train']*4+['test']*2),'group':np.arange(6)}
 features=np.arange(18).reshape(6,3).astype(float);features[4:]+=1e6;fitted=[];original=T.StandardScaler.fit
 def spy(self,x,*args,**kwargs):fitted.append(x.copy());return original(self,x,*args,**kwargs)
 monkeypatch.setattr(T.StandardScaler,'fit',spy);p=baseline(d,features)
 np.testing.assert_array_equal(fitted[0],features[:4]);assert p.shape==(6,2)


def test_download_zip_traversal_is_refused(tmp_path):
 p=tmp_path/'bad.zip'
 with zipfile.ZipFile(p,'w') as z:z.writestr('../escaped.txt','bad')
 with pytest.raises(ValueError,match='unsafe archive'):safe_extract(p,tmp_path/'data')
 assert not (tmp_path/'escaped.txt').exists()


def test_adult_emotion_is_saved_owner_scoped_and_questionnaire_only(app_client,monkeypatch):
 from backend.tests.test_speech_facial import _wav_b64
 from backend.tests.conftest import screening_body
 from backend.ml import speech_features as SF
 monkeypatch.setattr(SF,'extract_features',lambda *args:{'mfcc_mean':[0.]*13,'mfcc_std':[1.]*13,'pitch_mean':180.,'pitch_std':1.,'speech_rate':1.,'voiced_fraction':1.,'energy_mean':.1,'energy_std':.01})
 c=app_client();c.post('/auth/register',json={'name':'Technical fixture','email':'emotion@example.com','password':'fixture-password-9'})
 body=screening_body(points=6,category='adult',age=30,speechSkipped=False,audioBase64=_wav_b64(),audioMimeType='audio/wav')
 r=c.post('/screening/screen',json=body);assert r.status_code==200,r.text
 response=r.json();emotion=next(s for s in response['modalities'] if s['id']=='speech_emotion')
 assert emotion['output']['kind']=='speech_emotion' and emotion['in_result'] is False
 assert response['result']['modalities_in_result']==['questionnaire'] and response['aq10Score']==6
 saved=c.get(f"/cases/{response['caseId']}").json();assert next(s for s in saved['modality_states'] if s['id']=='speech_emotion')==emotion
 assert saved['speech_features']['pitch_mean']==180.
 assert next(s for s in saved['modality_states'] if s['id']=='speech')['output'] is None
 other=app_client();other.post('/auth/register',json={'name':'Other fixture','email':'other-emotion@example.com','password':'fixture-password-9'})
 assert other.get(f"/cases/{response['caseId']}").status_code==404


def test_child_never_runs_adult_emotion_model(app_client,monkeypatch):
 from backend.tests.test_speech_facial import _wav_b64
 from backend.tests.conftest import screening_body
 from backend.ml import speech_features as SF
 monkeypatch.setattr(SF,'extract_features',lambda *args:{})
 monkeypatch.setattr(R,'speech_emotion',lambda *args:pytest.fail('adult model called on child'))
 c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'child-emotion@example.com','password':'fixture-password-9'})
 r=c.post('/screening/screen',json=screening_body(speechSkipped=False,audioBase64=_wav_b64(),audioMimeType='audio/wav'));assert r.status_code==200,r.text
 s=next(x for x in r.json()['modalities'] if x['id']=='speech_emotion');assert s['output'] is None and 'adult' in s['reason']


def test_adult_expression_and_child_withholding_preserve_face_measurements(app_client,monkeypatch):
 from backend.tests.test_speech_facial import _png_b64
 from backend.tests.conftest import screening_body
 from backend.ml import facial_engine as FE
 # Controlled detector boundary, not real face/camera evidence. Actual shipped CNN runs.
 monkeypatch.setattr(FE._cv,'_detect_face',lambda cv,bgr:((20,20,80,80),'controlled-test-detector'))
 image=_png_b64(np.full((128,128,3),128,np.uint8))
 c=app_client();c.post('/auth/register',json={'name':'Fixture','email':'face-model@example.com','password':'fixture-password-9'})
 adult=c.post('/screening/screen',json=screening_body(points=6,category='adult',age=30,facialSkipped=False,facialImageBase64=image));assert adult.status_code==200,adult.text
 states=adult.json()['modalities'];expression=next(s for s in states if s['id']=='facial_expression')
 assert expression['status']=='available_experimental' and expression['output']['kind']=='facial_expression'
 assert next(s for s in states if s['id']=='facial')['measurements']['face_detected'] is True
 assert adult.json()['result']['modalities_in_result']==['questionnaire']
 saved=c.get('/cases/'+adult.json()['caseId']).json()
 assert saved['facial_features']==next(s for s in states if s['id']=='facial')['measurements']
 child=c.post('/screening/screen',json=screening_body(facialSkipped=False,facialImageBase64=image));assert child.status_code==200,child.text
 assert next(s for s in child.json()['modalities'] if s['id']=='facial_expression')['output'] is None
