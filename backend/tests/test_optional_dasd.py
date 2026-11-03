"""Optional-data prerequisites and synthetic numeric engineering coverage only."""
import numpy as np
import pytest
from backend.data import dasd
from backend.ml.gaze import quality as Q, service as S
from backend.tests.test_gaze_openface import synth


def test_absent_dataset_is_optional(tmp_path):
    assert dasd.optional_recordings(tmp_path/'not-installed') is None


def test_present_root_without_dataset_is_an_error(tmp_path):
    with pytest.raises(ValueError,match='dataset directory is missing'):
        dasd.optional_recordings(tmp_path)


def test_present_incomplete_dataset_is_an_error(tmp_path):
    (tmp_path/'dataset').mkdir()
    with pytest.raises(ValueError,match='label counts'):
        dasd.optional_recordings(tmp_path)


def test_present_malformed_recording_is_an_error(tmp_path,monkeypatch):
    folder=tmp_path/'dataset/train/normal';folder.mkdir(parents=True)
    (folder/'synthetic.csv').write_text('not_openface\n1\n')
    monkeypatch.setitem(dasd.README_COUNTS,'ASD',0);monkeypatch.setitem(dasd.README_COUNTS,'TD',1)
    with pytest.raises(ValueError,match='Malformed DASD recording.*missing columns'):
        dasd.optional_recordings(tmp_path)


@pytest.mark.parametrize('factor,status,direction',[(1.,'in_domain',None),(np.exp(10),'out_of_domain','above'),(np.exp(-10),'out_of_domain','below')])
def test_domain_math_without_participant_data(factor,status,direction):
    ref={'gaze_angle_x':{'median_log_std':np.log(.1),'sigma':.2,'median_std':.1}}
    outcome=Q.domain_check({'gaze_angle_x':.1*factor},ref)
    assert outcome['status']==status and outcome['direction']==direction


def test_frozen_service_on_synthetic_numeric_in_range_and_withheld_inputs():
    """Deterministic software fixture; no actual participant behavior or webcam evidence."""
    svc=S.GazeService(); assert svc.available
    frame=synth(n=600)
    t=np.arange(len(frame))/25
    mapping=Q.GATE_CHANNELS
    for i,(name,col) in enumerate(mapping.items()):
        target=svc.meta['domain_reference'][name]['median_std']
        frame[' '+col]=np.sqrt(2)*target*np.sin(2*np.pi*(.5+.1*i)*t)
    result=svc.analyze_frames(frame,'synthetic-numeric-engineering')
    assert result['quality']['valid'] and result['domain']['status']=='in_domain'
    assert result['status']=='success' and np.isfinite(result['probability'])
    assert result['fusion_eligible'] is False
    for col in mapping.values(): frame[' '+col]*=.001
    withheld=svc.analyze_frames(frame,'synthetic-numeric-engineering')
    assert withheld['quality']['valid'] and withheld['status']=='out_of_domain'
    assert withheld['probability'] is None and withheld['fusion_eligible'] is False
