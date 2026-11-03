"""Development-only DASD comparisons. Never loads/saves a shipped checkpoint.

Protocol and interpretation: docs/GAZE_EXPERIMENT_PROTOCOL.md. Experiment outputs
contain private participant predictions; they belong in ignored experiments/ or /tmp.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import subprocess
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, confusion_matrix, roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from backend.data import dasd
from backend.ml.gaze import config as C, inference as I, model as M, preprocess as P, quality as Q

CFG = C.MODEL_CONFIGS['gaze-openface-dasd-v3']
METADATA_NAMES = ('duration_s', 'frames', 'fps', 'max_gap_s', 'valid_ratio', 'continuity', 'confidence', 'windows')


@dataclass
class Subject:
    participant_id: str
    label: int
    windows: np.ndarray
    metadata: np.ndarray
    domain: dict


@dataclass(frozen=True)
class Protocol:
    folds: int = 5
    seeds: tuple[int, ...] = (20261103, 20261104)
    epochs: int = 14
    permutations: int = 5
    bootstrap: int = 2000

    def validate(self):
        if self.folds < 2 or not self.seeds or len(set(self.seeds)) != len(self.seeds):
            raise ValueError('need >=2 folds and distinct nonempty repeat seeds')
        if min(self.epochs, self.permutations, self.bootstrap) < 1:
            raise ValueError('epochs, permutations and bootstrap must be positive')


def load_development(root: Path):
    """Discover split inventory; READ ONLY official train CSV contents, never test CSVs."""
    recs = dasd.discover(root)
    dasd.validate_labels(recs)
    dev, historical_test = dasd.official_split(recs)
    dasd.assert_disjoint(dev, historical_test)
    subjects, manifest, excluded = [], [], []
    hashes = set()
    for rec in sorted(dev, key=lambda r: r.participant_id):
        digest = hashlib.sha256(rec.path.read_bytes()).hexdigest()
        if digest in hashes:
            raise ValueError('duplicate development recording content under distinct IDs')
        hashes.add(digest)
        frame = dasd.read_csv(rec).rename(columns=str.strip)
        missing = set(C.REQUIRED_COLUMNS + C.HEAD_POSE_COLUMNS) - set(frame.columns)
        if missing:
            raise ValueError(f'malformed development CSV: missing columns {sorted(missing)}')
        prep = P.prepare_session(frame, CFG)
        quality = Q.assess(prep)
        manifest.append({'participant_id': rec.participant_id, 'label': rec.label,
                         'sha256': digest, 'quality': quality.to_dict()})
        if not quality.valid:
            excluded.append({'label': rec.label, 'reason': quality.reason})
            continue
        ts = frame.timestamp.to_numpy(float)
        if not np.isfinite(ts).all() or len(ts) < 2 or np.any(np.diff(ts) <= 0):
            raise ValueError('development CSV has invalid/non-monotonic raw timestamps')
        duration = float(ts[-1] - ts[0])
        metadata = np.array([duration, len(frame), (len(frame)-1)/duration,
                             np.diff(ts).max(), quality.valid_sample_ratio,
                             quality.tracking_continuity, quality.mean_confidence,
                             len(prep.windows)], float)
        subjects.append(Subject(rec.participant_id, rec.label, prep.windows, metadata,
                                Q.domain_stats(prep, CFG)))
    return subjects, {'development': manifest, 'excluded': excluded,
                      'historical_test_inventory_n': len(historical_test),
                      'historical_test_contents_read': False}


def validate_subjects(subjects, protocol):
    protocol.validate()
    ids = [s.participant_id for s in subjects]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate participant IDs: all sessions/windows must stay grouped')
    y = np.array([s.label for s in subjects])
    if set(y) != {0, 1} or min(np.bincount(y)) < protocol.folds:
        raise ValueError('need both classes with at least folds participants per class')
    for s in subjects:
        if (s.windows.ndim != 3 or s.windows.shape[1:] != (CFG.window_steps, len(CFG.feature_names))
                or not len(s.windows) or not np.isfinite(s.windows).all()
                or s.metadata.shape != (len(METADATA_NAMES),) or not np.isfinite(s.metadata).all()
                or set(s.domain) != set(Q.GATE_CHANNELS)
                or not all(np.isfinite(v) and v >= 0 for v in s.domain.values())):
            raise ValueError('invalid windows, metadata or required domain channels')


def distribution_features(windows):
    """Unordered within-window statistics, median across windows; no fitted state."""
    q = np.quantile(windows, [.1, .25, .5, .75, .9], axis=1)
    per_window = np.concatenate([windows.std(axis=1), q[0], q[2], q[4], q[3]-q[1]], axis=1)
    return np.median(per_window, axis=0)


def shuffled_subject(subject, seed):
    """Joint x/y shuffle WITHIN each window; no transfer across participants/folds."""
    rng = np.random.default_rng(seed)
    shuffled = np.stack([w[rng.permutation(len(w))] for w in subject.windows])
    return Subject(subject.participant_id, subject.label, shuffled, subject.metadata.copy(), dict(subject.domain))


def fit_tabular(train, test, labels, metadata=False):
    feature = (lambda s: s.metadata) if metadata else (lambda s: distribution_features(s.windows))
    pipeline = make_pipeline(StandardScaler(), LogisticRegression(C=.3, class_weight='balanced', max_iter=5000))
    pipeline.fit(np.stack([feature(s) for s in train]), labels)
    return pipeline.predict_proba(np.stack([feature(s) for s in test]))[:, 1]


def fit_bilstm(train, test, labels, seed, epochs):
    """Same v3 input/architecture, newly initialized fold model, fixed epoch budget.

    No checkpoint loading, tuning, calibration, learned feature selection or export.
    Only training windows enter normalization/loss/class weights.
    """
    import torch
    old_threads = torch.get_num_threads()
    old_determinism = torch.are_deterministic_algorithms_enabled()
    try:
        torch.set_num_threads(1)
        torch.use_deterministic_algorithms(True)
        with torch.random.fork_rng():
            torch.manual_seed(seed)
            windows = np.concatenate([s.windows for s in train])
            norm = P.fit_normalizer(windows)
            x = torch.from_numpy(P.normalize(windows, norm))
            counts = np.bincount(labels, minlength=2)
            targets = np.concatenate([np.full(len(s.windows), y) for s, y in zip(train, labels)])
            weights = np.concatenate([np.full(len(s.windows), len(train)/(2*counts[y]*len(s.windows)))
                                      for s, y in zip(train, labels)])
            weights = weights / weights.mean()
            y, w = torch.tensor(targets, dtype=torch.float32), torch.tensor(weights, dtype=torch.float32)
            model = M.GazeBiLSTM(len(CFG.feature_names), 32, .4)
            optimizer = torch.optim.AdamW(model.parameters(), lr=.002, weight_decay=.01)
            loss_fn = torch.nn.BCEWithLogitsLoss(reduction='none')
            for _ in range(epochs):
                model.train()
                order = torch.randperm(len(x))
                for start in range(0, len(order), 64):
                    ix = order[start:start+64]
                    logits = model(x[ix] + .02*torch.randn_like(x[ix]))
                    loss = (loss_fn(logits, y[ix])*w[ix]).sum()/w[ix].sum()
                    optimizer.zero_grad(); loss.backward()
                    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.)
                    optimizer.step()
            model.eval()
            return np.array([I.aggregate(I.predict_windows(model, s.windows, norm)) for s in test])
    finally:
        torch.set_num_threads(old_threads)
        torch.use_deterministic_algorithms(old_determinism)


def metrics(y, p):
    y, p = np.asarray(y), np.asarray(p)
    tn, fp, fn, tp = confusion_matrix(y, p >= .5, labels=[0, 1]).ravel()
    return {'n': len(y), 'auc': float(roc_auc_score(y, p)) if len(set(y)) == 2 else None,
            'brier_uncalibrated': float(brier_score_loss(y, p)),
            'sensitivity_at_0_5': float(tp/(tp+fn)) if tp+fn else None,
            'specificity_at_0_5': float(tn/(tn+fp)) if tn+fp else None}


def bootstrap_auc(y, a, b, draws, seed):
    """Paired participant bootstrap; b=None gives AUC CI, otherwise difference CI."""
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(draws):
        ix = rng.integers(0, len(y), len(y))
        if len(set(y[ix])) == 2:
            value = roc_auc_score(y[ix], a[ix])
            if b is not None:
                value -= roc_auc_score(y[ix], b[ix])
            values.append(value)
    if not values:
        raise ValueError('no two-class participant bootstrap samples')
    return np.quantile(values, [.025, .975]).tolist()


def evaluate(subjects, protocol, tabular=fit_tabular, bilstm=fit_bilstm):
    """All comparisons share participant folds; no outer-test input reaches a fit."""
    validate_subjects(subjects, protocol)
    subjects = sorted(subjects, key=lambda s: s.participant_id)
    y = np.array([s.label for s in subjects])
    ids = [s.participant_id for s in subjects]
    predictions, splits, permutations = [], [], []
    for seed in protocol.seeds:
        splits_for_seed = list(StratifiedKFold(protocol.folds, shuffle=True, random_state=seed).split(ids, y))
        shuffled = [shuffled_subject(s, seed+i) for i, s in enumerate(subjects)]
        targets = [('observed', y)]
        # Conditional permutation within pre-existing folds preserves class counts and fold identity.
        for permutation in range(protocol.permutations):
            permuted = y.copy(); rng = np.random.default_rng(seed+1000+permutation)
            for _, te in splits_for_seed:
                permuted[te] = rng.permutation(y[te])
            targets.append((f'permutation_{permutation}', permuted))
            permutations.append({'seed': seed, 'control': targets[-1][0], 'targets': permuted.tolist()})
        for fold, (tr, te) in enumerate(splits_for_seed):
            train = [subjects[i] for i in tr]; test = [subjects[i] for i in te]
            splits.append({'seed': seed, 'fold': fold, 'train': [ids[i] for i in tr], 'test': [ids[i] for i in te]})
            reference = Q.domain_reference([s.domain for s in train])
            domain = [Q.domain_check(s.domain, reference)['status'] for s in test]
            for control, target in targets:
                arms = {'statistics_lr': tabular(train, test, target[tr]),
                        'metadata_lr': tabular(train, test, target[tr], metadata=True),
                        'bilstm': bilstm(train, test, target[tr], seed+fold, protocol.epochs)}
                if control == 'observed':
                    arms['bilstm_time_shuffled'] = bilstm([shuffled[i] for i in tr], [shuffled[i] for i in te],
                                                         target[tr], seed+fold, protocol.epochs)
                for arm, scores in arms.items():
                    if len(scores) != len(te) or not np.isfinite(scores).all() or np.any((scores < 0)|(scores > 1)):
                        raise ValueError('invalid model scores; refusing incomplete OOF output')
                    for index, score, status in zip(te, scores, domain):
                        predictions.append({'participant_id': ids[index], 'seed': seed, 'fold': fold,
                                            'control': control, 'arm': arm, 'target': int(target[index]),
                                            'score_uncalibrated': float(score), 'domain_status': status,
                                            'gated_output': None if status == 'out_of_domain' else float(score)})
    summary = {}
    observed = [r for r in predictions if r['control'] == 'observed']
    mean_scores = {}
    for arm in sorted({r['arm'] for r in observed}):
        rows = [r for r in observed if r['arm'] == arm]
        means = np.array([np.mean([r['score_uncalibrated'] for r in rows if r['participant_id'] == pid]) for pid in ids])
        mean_scores[arm] = means
        per_repeat = [metrics(y, [next(r['score_uncalibrated'] for r in rows if r['seed'] == sd and r['participant_id'] == pid)
                                  for pid in ids]) for sd in protocol.seeds]
        summary[arm] = {'repeat_metrics': per_repeat, 'repeat_averaged_oof': metrics(y, means),
                        'auc_ci95_participant_bootstrap': bootstrap_auc(y, means, None, protocol.bootstrap, 0),
                        'gated_repeat_metrics': []}
        for sd in protocol.seeds:
            accepted = [r for r in rows if r['seed'] == sd and r['gated_output'] is not None]
            summary[arm]['gated_repeat_metrics'].append({
                'seed': sd, 'accepted_n': len(accepted),
                'metrics': metrics([r['target'] for r in accepted], [r['gated_output'] for r in accepted]) if accepted else None})
    controls = []
    for sd in protocol.seeds:
        for permutation in range(protocol.permutations):
            name = f'permutation_{permutation}'
            for arm in ('statistics_lr', 'metadata_lr', 'bilstm'):
                rows = [r for r in predictions if r['seed'] == sd and r['control'] == name and r['arm'] == arm]
                controls.append({'seed': sd, 'control': name, 'arm': arm,
                                 **metrics([r['target'] for r in rows], [r['score_uncalibrated'] for r in rows])})
    paired = {arm: {'difference': float(roc_auc_score(y, mean_scores['bilstm'])-roc_auc_score(y, scores)),
                    'ci95': bootstrap_auc(y, mean_scores['bilstm'], scores, protocol.bootstrap, 1)}
              for arm, scores in mean_scores.items() if arm != 'bilstm'}
    coverage = {str(label): {status: sum(r['target'] == label and r['domain_status'] == status
                                       for r in observed if r['arm'] == 'bilstm')
                             for status in ('in_domain', 'marginal', 'out_of_domain')} for label in (0, 1)}
    return {'scope': 'exploratory development-only; no untouched test or clinical validation',
            'n': len(subjects), 'protocol': asdict(protocol), 'models': summary,
            'paired_auc_bilstm_minus_ci95': paired, 'label_permutation_controls': controls,
            'domain_counts_participant_repeats': coverage,
            'calibration': 'not fitted; all scores uncalibrated; no population probabilities',
            'screening_integration': False}, {'predictions': predictions, 'splits': splits, 'permutations': permutations}


def artifact_hashes():
    return {str(p.relative_to(M.MODELS_DIR)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(M.MODELS_DIR.rglob('*')) if p.is_file() and p.suffix in {'.pt', '.json'}}


def git_provenance(root):
    try:
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True, stderr=subprocess.DEVNULL).strip()
        dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True, stderr=subprocess.DEVNULL).strip())
        return {'implementation_commit': commit, 'working_tree_dirty': dirty, 'source_control_status': 'available'}
    except (OSError, subprocess.CalledProcessError):
        return {'implementation_commit': None, 'working_tree_dirty': None,
                'source_control_status': 'unavailable: source archive or git inaccessible'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-root', type=Path, default=dasd.DASD_ROOT)
    parser.add_argument('--out', type=Path, required=True, help='new private directory; never overwrite an experiment')
    parser.add_argument('--data-permission-reference', help='operator reference documenting permission for this use; not a licence grant')
    parser.add_argument('--folds', type=int, default=5)
    parser.add_argument('--seeds', type=int, nargs='+', default=[20261103, 20261104])
    parser.add_argument('--epochs', type=int, default=14)
    parser.add_argument('--permutations', type=int, default=5)
    parser.add_argument('--bootstrap', type=int, default=2000)
    args = parser.parse_args(argv)
    protocol = Protocol(args.folds, tuple(args.seeds), args.epochs, args.permutations, args.bootstrap)
    protocol.validate()
    root = Path(__file__).resolve().parents[2]
    out = args.out.resolve()
    if out == root or root in out.parents and (root/'experiments') not in out.parents:
        parser.error('repository outputs must be under ignored experiments/; never write models/reports/application data')
    if out == args.data_root.resolve() or args.data_root.resolve() in out.parents:
        parser.error('experiment outputs must be separate from the source dataset')
    old_umask = os.umask(0o077)
    try:
        out.mkdir(parents=True, exist_ok=False)
        provenance = {**git_provenance(root),
                      'harness_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                      'started_at_utc': datetime.now(timezone.utc).isoformat(),
                      'environment': {'python': platform.python_version(), 'platform': platform.platform(),
                                      **{p: importlib.metadata.version(p) for p in ('numpy', 'pandas', 'scikit-learn', 'torch')}},
                      'protocol': asdict(protocol), 'data_permission_reference': args.data_permission_reference}
        if not args.data_root.exists() or not args.data_permission_reference:
            reason = 'DASD absent' if not args.data_root.exists() else 'DASD reuse permission reference missing'
            (out/'summary.json').write_text(json.dumps({**provenance, 'status': 'blocked', 'reason': reason}, indent=2))
            print(reason); return 2
        before = artifact_hashes()
        try:
            try:
                subjects, manifest = load_development(args.data_root)
                summary, private = evaluate(subjects, protocol)
            finally:
                if artifact_hashes() != before:
                    raise RuntimeError('shipped artifacts changed during experiment; investigate before accepting results')
            summary['shipped_artifact_sha256_unchanged'] = before
            summary['cohort'] = {
                'development_n_before_quality': len(manifest['development']),
                'included_by_label': {str(y): sum(s.label == y for s in subjects) for y in (0, 1)},
                'excluded_by_label_reason': {str(y): {reason: sum(r['label'] == y and r['reason'] == reason
                    for r in manifest['excluded']) for reason in sorted({r['reason'] for r in manifest['excluded']})}
                    for y in (0, 1)}, 'historical_test_contents_read': False}
            (out/'private_audit.json').write_text(json.dumps({**manifest, **private}, indent=2))
            (out/'summary.json').write_text(json.dumps({**provenance, 'status': 'completed', **summary}, indent=2))
        except Exception as exc:
            (out/'summary.json').write_text(json.dumps({**provenance, 'status': 'failed', 'reason': str(exc)}, indent=2))
            raise
        print(f'Completed development-only comparison: {out}'); return 0
    finally:
        os.umask(old_umask)


if __name__ == '__main__':
    raise SystemExit(main())
