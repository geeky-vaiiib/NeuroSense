"""Run backend acceptance from a private source export, never the dataset-bearing checkout.

Usage: .venv-demo/bin/python scripts/check_backend_isolated.py
Uses current tracked working-tree contents (including staged new files), not just HEAD.
Copies no ignored data, environment secrets, symlinks or external recordings. Database
and import paths are overridden before subprocess startup. No source files are changed.
"""
from pathlib import Path
import os
import secrets
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {'.git', 'DASD-main', 'research-data', 'experiments', 'node_modules'}


def export_source(root, destination, names):
    for name in names:
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe source path')
        if EXCLUDED_PARTS.intersection(relative.parts):
            continue
        if relative.name.startswith('.env') and relative.name != '.env.example':
            continue
        source = root / relative
        if not source.exists():  # respect a working-tree deletion
            continue
        if source.is_symlink() or root.resolve() not in source.resolve().parents:
            raise ValueError('External/symlinked source refused: ' + name)
        if source.is_file():
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def isolated_environment(destination):
    env = os.environ.copy()
    env.update(PYTHONPATH=os.pathsep.join([str(destination/'backend'), str(destination)]),
               MONGODB_URI='mongomock://isolated-acceptance', MONGODB_DB_NAME='isolated_acceptance',
               JWT_SECRET=secrets.token_urlsafe(48), COOKIE_SECURE='false', GAZE_WARMUP='0',
               OMP_NUM_THREADS='2', NS_RECORDING_TMP_DIR=str(destination/'private-spool'),
               NUMBA_CACHE_DIR=str(destination/'numba-cache'))
    return env


def main():
    names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    with tempfile.TemporaryDirectory(prefix='neurosense-isolated-check-') as directory:
        destination = Path(directory)
        export_source(ROOT, destination, filter(None, names))
        env = isolated_environment(destination)
        # Verify imports before collecting any dataset-sensitive tests.
        probe = ('from pathlib import Path; from backend.data import dasd; '
                 'assert Path.cwd() in Path(dasd.__file__).resolve().parents; '
                 'assert not dasd.DASD_ROOT.exists(); '
                 'print("PASS isolated imports; optional DASD data absent", flush=True)')
        commands = [[sys.executable, '-c', probe],
                    [sys.executable, '-m', 'pytest', 'backend/tests', '-q'],
                    [sys.executable, 'scripts/check_research_consistency.py'],
                    [sys.executable, 'scripts/check_gaze_consistency.py']]
        for command in commands:
            result = subprocess.run(command, cwd=destination, env=env)
            if result.returncode:
                return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
