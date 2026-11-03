"""Engineering invariants using arbitrary software binary groups, NOT diagnostic labels.

No participants, webcam evidence, model-quality claims or external dataset downloads.
"""
import json

import numpy as np
import pytest

from backend.data import evaluate_gaze_development as E
from backend.tests.test_gaze_openface import synth


def software_subjects(n=12):
    rng = np.random.default_rng(4)
    return [E.Subject(f'software-{i:02}', i % 2, rng.normal(0, .1, (2, 60, 2)),
                      np.full(8, i+1.), {name: .1+.01*i for name in E.Q.GATE_CHANNELS}) for i in range(n)]


def fake_tabular(train, test, labels, metadata=False):
    assert not {s.participant_id for s in train} & {s.participant_id for s in test}
    assert len(labels) == len(train)
    return np.full(len(test), .4)


def fake_bilstm(train, test, labels, seed, epochs):
    return fake_tabular(train, test, labels)


def test_participant_folds_oof_permutations_and_domain_fit_are_isolated(monkeypatch):
    subjects = software_subjects()
    calls = []
    reference = E.Q.domain_reference
    def record_reference(stats):
        calls.append(stats)
        return reference(stats)
    monkeypatch.setattr(E.Q, 'domain_reference', record_reference)
    protocol = E.Protocol(folds=3, seeds=(11, 12), epochs=1, permutations=2, bootstrap=10)
    summary, audit = E.evaluate(subjects, protocol, fake_tabular, fake_bilstm)
    lookup = {s.participant_id: s for s in subjects}
    for split, fitted_stats in zip(audit['splits'], calls):
        assert not set(split['train']) & set(split['test'])
        assert fitted_stats == [lookup[pid].domain for pid in split['train']]
    for seed in protocol.seeds:
        testing = [pid for split in audit['splits'] if split['seed'] == seed for pid in split['test']]
        assert sorted(testing) == sorted(lookup)
        for permutation in [r for r in audit['permutations'] if r['seed'] == seed]:
            targets = dict(zip(sorted(lookup), permutation['targets']))
            for split in [r for r in audit['splits'] if r['seed'] == seed]:
                assert sum(targets[pid] for pid in split['test']) == sum(lookup[pid].label for pid in split['test'])
    assert len(audit['predictions']) == len(subjects)*2*(4+2*3)
    assert summary['screening_integration'] is False
    assert 'uncalibrated' in summary['calibration']


def test_temporal_shuffle_preserves_joint_pairs_and_unordered_statistics():
    subject = software_subjects()[0]
    original = subject.windows.copy()
    shuffled = E.shuffled_subject(subject, 19)
    np.testing.assert_array_equal(subject.windows, original)
    assert not np.array_equal(shuffled.windows, original)
    for before, after in zip(original, shuffled.windows):
        assert sorted(map(tuple, before)) == sorted(map(tuple, after))
    np.testing.assert_allclose(E.distribution_features(original), E.distribution_features(shuffled.windows))


@pytest.mark.parametrize('defect', ['duplicate_id', 'too_few_per_class', 'nonfinite', 'missing_domain'])
def test_invalid_participant_inputs_fail(defect):
    subjects = software_subjects()
    if defect == 'duplicate_id': subjects[1].participant_id = subjects[0].participant_id
    if defect == 'too_few_per_class': subjects = subjects[:2]
    if defect == 'nonfinite': subjects[0].windows[0, 0, 0] = np.nan
    if defect == 'missing_domain': subjects[0].domain.pop('head_pose_x')
    with pytest.raises(ValueError):
        E.validate_subjects(subjects, E.Protocol())


def test_invalid_prediction_fails_instead_of_fabricating_oof_output():
    def broken(*args, **kwargs): return np.array([np.nan])
    with pytest.raises(ValueError, match='invalid model scores'):
        E.evaluate(software_subjects(), E.Protocol(folds=2, seeds=(1,), permutations=1, bootstrap=2), broken, fake_bilstm)


def test_out_of_domain_outputs_are_null():
    subjects = software_subjects()
    subjects[0].domain = {name: 1e-12 for name in E.Q.GATE_CHANNELS}
    summary, audit = E.evaluate(subjects, E.Protocol(folds=2, seeds=(1,), permutations=1, bootstrap=2), fake_tabular, fake_bilstm)
    rows = [r for r in audit['predictions'] if r['participant_id'] == subjects[0].participant_id]
    assert rows and all(r['domain_status'] == 'out_of_domain' and r['gated_output'] is None for r in rows)
    assert summary['models']['bilstm']['gated_repeat_metrics'][0]['accepted_n'] < len(subjects)


def test_real_fold_bilstm_normalizes_training_only_and_is_repeatable(monkeypatch):
    subjects = software_subjects(6)
    train, test = subjects[:4], subjects[4:]
    test[0].windows += 100  # adversarial held-out values must not enter training normalization
    fitted = []
    fit_normalizer = E.P.fit_normalizer
    def spy(windows):
        fitted.append(windows.copy())
        return fit_normalizer(windows)
    monkeypatch.setattr(E.P, 'fit_normalizer', spy)
    labels = np.array([s.label for s in train])
    before = E.artifact_hashes()
    a = E.fit_bilstm(train, test, labels, seed=3, epochs=1)
    test[0].metadata += 1e6
    b = E.fit_bilstm(train, test, labels, seed=3, epochs=1)
    np.testing.assert_array_equal(fitted[0], np.concatenate([s.windows for s in train]))
    np.testing.assert_array_equal(a, b)
    assert len(a) == 2 and np.isfinite(a).all()
    assert E.artifact_hashes() == before


@pytest.mark.parametrize('metadata', [False, True])
def test_tabular_scaler_fits_only_training_participants(monkeypatch, metadata):
    subjects = software_subjects(6)
    train, test = subjects[:4], subjects[4:]
    test[0].metadata += 1e6
    test[0].windows += 100
    captured = []
    original = E.StandardScaler.fit
    def spy(self, values, *args, **kwargs):
        captured.append(values.copy())
        return original(self, values, *args, **kwargs)
    monkeypatch.setattr(E.StandardScaler, 'fit', spy)
    scores = E.fit_tabular(train, test, np.array([s.label for s in train]), metadata=metadata)
    feature = (lambda s: s.metadata) if metadata else (lambda s: E.distribution_features(s.windows))
    np.testing.assert_array_equal(captured[0], np.stack([feature(s) for s in train]))
    assert len(scores) == len(test) and np.isfinite(scores).all()


def test_development_loader_never_reads_historical_test_contents(tmp_path, monkeypatch):
    train = E.dasd.Recording('software/dev', tmp_path/'dev.csv', 0, 'train')
    historical = E.dasd.Recording('software/historical', tmp_path/'must-not-read.csv', 1, 'test')
    train.path.write_text('software-hash-fixture')
    monkeypatch.setattr(E.dasd, 'discover', lambda root: [train, historical])
    monkeypatch.setattr(E.dasd, 'validate_labels', lambda recs: None)
    reads = []
    def read(rec):
        reads.append(rec)
        assert rec == train
        return synth(n=600)
    monkeypatch.setattr(E.dasd, 'read_csv', read)
    subjects, audit = E.load_development(tmp_path)
    assert len(subjects) == 1 and reads == [train]
    assert audit['historical_test_contents_read'] is False


@pytest.mark.parametrize('present', [False, True])
def test_cli_reports_blocked_without_reading_data(tmp_path, monkeypatch, present):
    data = tmp_path/'optional-data'
    if present: data.mkdir()
    def unexpected(*args): pytest.fail('blocked CLI must not load participant data')
    monkeypatch.setattr(E, 'load_development', unexpected)
    out = tmp_path/'experiment'
    assert E.main(['--data-root', str(data), '--out', str(out)]) == 2
    summary = json.loads((out/'summary.json').read_text())
    assert summary['status'] == 'blocked' and 'models' not in summary
    with pytest.raises(FileExistsError):
        E.main(['--data-root', str(data), '--out', str(out)])


def test_cli_cannot_write_in_shipped_artifact_tree():
    with pytest.raises(SystemExit):
        E.main(['--out', str(E.M.MODELS_DIR/'forbidden-experiment')])


def test_cli_mutated_artifacts_cannot_leave_success_report(tmp_path, monkeypatch):
    data = tmp_path/'data'; data.mkdir()
    out = tmp_path/'experiment'
    monkeypatch.setattr(E, 'load_development', lambda root: ([], {}))
    monkeypatch.setattr(E, 'evaluate', lambda *args: ({}, {}))
    hashes = iter([{'software-artifact': 'before'}, {'software-artifact': 'after'}])
    monkeypatch.setattr(E, 'artifact_hashes', lambda: next(hashes))
    with pytest.raises(RuntimeError, match='shipped artifacts changed'):
        E.main(['--data-root', str(data), '--out', str(out), '--data-permission-reference', 'unit-test-no-participant-data'])
    assert json.loads((out/'summary.json').read_text())['status'] == 'failed'
    assert not (out/'private_audit.json').exists()


def test_cli_source_data_directory_cannot_receive_outputs(tmp_path):
    with pytest.raises(SystemExit):
        E.main(['--data-root', str(tmp_path), '--out', str(tmp_path/'experiment')])


def test_source_archive_has_explicit_unavailable_commit_provenance(tmp_path, monkeypatch):
    def unavailable(*args, **kwargs):
        raise E.subprocess.CalledProcessError(128, 'git')
    monkeypatch.setattr(E.subprocess, 'check_output', unavailable)
    state = E.git_provenance(tmp_path)
    assert state['implementation_commit'] is None and state['working_tree_dirty'] is None
    assert state['source_control_status'].startswith('unavailable')
