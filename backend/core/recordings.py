"""Private spool and conservative cleanup for abandoned temporary recordings."""
from __future__ import annotations
import logging
import os
from pathlib import Path
import shutil
import tempfile
import time

RETENTION_S = 2 * 3600
logger = logging.getLogger('neurosense.recordings')


def spool() -> Path:
    root = Path(os.environ.get('NS_RECORDING_TMP_DIR', str(Path(tempfile.gettempdir()) / 'neurosense-recordings')))
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return root


def cleanup_expired() -> int:
    """Startup/operator sweep, scoped to this application's spool and prefixes.

    Only files older than retention are removed. A live durable lease protects raw
    video. This is retention cleanup, not cancellation of timed-out computation.
    """
    from .database import get_db
    now = time.time()
    count = 0
    for p in spool().iterdir():
        if not p.name.startswith(('ns_upload_', 'ns_gaze_')) or p.is_symlink():
            continue
        if now - p.stat().st_mtime < RETENTION_S:
            continue
        if get_db()['gaze_jobs'].find_one({'raw_path': str(p), 'state': 'processing',
                                         'lease_until': {'$gt': now}, 'deadline': {'$gt': now}}):
            continue
        if p.is_dir(): shutil.rmtree(p)
        else: p.unlink(missing_ok=True)
        count += 1
    logger.info('Expired recording spool entries removed: %s', count)
    return count
