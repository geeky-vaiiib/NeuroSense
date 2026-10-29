"""Webcam domain validation: may the model be used on NeuroSense webcam recordings, and may gaze enter fusion?

    python -m backend.data.validate_webcam_domain --csv-dir <folder of OpenFace CSVs from real webcam sessions>

Replaces the first version of this check, which compared the pooled DASD mean/std (dominated by
between-child differences) with within-session webcam mean/std — different quantities, so it
rejected anything stiller than a pooled population.  The gate now compares like with like:

  per session, per position channel: z = (log within-session std - median) / (1.4826 * MAD),
  against the DASD per-child distribution stored in the checkpoint (see ml/gaze/quality.py).

  A  pipeline failure     OpenFace/schema errors, quality gate failing      -> not counted as domain evidence
  B  data-quality failure session fails the recording quality gate           -> excluded, reported
  C  normal variation     max|z| <= 3  (in_domain)                          -> counts towards the pass
  D  unsafe out-of-domain max|z| > 6    (out_of_domain; probability withheld); 3 < max|z| <= 6 is marginal

Pass requires >= 10 quality-valid sessions AND >= 80% of them in_domain.  Volunteer sessions carry no
ASD/TD labels: this is a technical applicability check, not clinical validation, and the sessions
should come from the target population (children), not adults.  Absolute position offsets are not
tested because the representation is session-centred.
On pass it writes backend/models/gaze_openface_webcam_validation.json, which unlocks fusion.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.data import dasd  # noqa: E402
from backend.ml.gaze import config as C  # noqa: E402
from backend.ml.gaze import preprocess as P  # noqa: E402
from backend.ml.gaze import quality as Q  # noqa: E402
from backend.ml.gaze.service import WEBCAM_VALIDATION_PATH  # noqa: E402

REPORTS = Path(__file__).resolve().parents[1] / "reports"


def main(argv=None) -> dict:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv-dir", required=True, type=Path)
    ap.add_argument("--out", type=Path, default=WEBCAM_VALIDATION_PATH)
    ap.add_argument("--allow-dasd", action="store_true", help="pipeline self-test with DASD files (never writes the real file)")
    a = ap.parse_args(argv)
    if dasd.DASD_ROOT in a.csv_dir.resolve().parents or a.csv_dir.resolve() == dasd.DASD_ROOT:
        if not a.allow_dasd or a.out == WEBCAM_VALIDATION_PATH:
            sys.exit("refusing: DASD files are not webcam recordings (use --allow-dasd with a different --out)")
    from backend.ml.gaze.service import get_gaze_service
    svc = get_gaze_service()
    if not svc.available:
        sys.exit(f"gaze model unavailable: {svc.load_error}")
    meta, cfg = svc.meta, svc.cfg; ref = meta["domain_reference"]
    sessions = []
    for f in sorted(a.csv_dir.glob("*.csv")):
        prep = P.prepare_session(pd.read_csv(f), cfg); q = Q.assess(prep)
        row = {"file": f.name[:12], "quality_valid": q.valid, "quality_reason": q.reason, "duration_s": q.duration_seconds,
               "mean_confidence": q.mean_confidence, "data_quality_score": q.data_quality_score}
        row["domain"] = Q.domain_check(Q.domain_stats(prep, cfg), ref) if q.valid else None
        sessions.append(row)
    valid = [s for s in sessions if s["quality_valid"]]
    in_dom = [s for s in valid if s["domain"]["status"] == "in_domain"]
    frac = len(in_dom) / len(valid) if valid else 0.0
    checks = {f"quality_valid_sessions>={C.MIN_LAB_SESSIONS}": len(valid) >= C.MIN_LAB_SESSIONS,
              f"in_domain_fraction>={C.MIN_LAB_IN_DOMAIN}": bool(frac >= C.MIN_LAB_IN_DOMAIN)}
    passed = all(checks.values())
    counts = {k: sum(1 for s in valid if s["domain"]["status"] == k) for k in ("in_domain", "marginal", "out_of_domain")}
    result = {"passed": passed, "checked_at": datetime.now(timezone.utc).isoformat(), "n_sessions": len(sessions),
              "n_quality_valid": len(valid), "domain_counts": counts, "in_domain_fraction": frac, "checks": checks,
              "sessions": sessions, "model_version": svc.model_version, "gate": {"z_in": C.DOMAIN_Z_IN, "z_out": C.DOMAIN_Z_OUT},
              "scope": "technical applicability check only; no ASD/TD ground truth, not clinical evidence",
              "reason": None if passed else "failed: " + ", ".join(k for k, v in checks.items() if not v)}
    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "gaze_domain_check.json").write_text(json.dumps(result, indent=2, default=float))
    a.out.write_text(json.dumps(result, indent=2, default=float))
    print(json.dumps({k: result[k] for k in ("passed", "n_sessions", "n_quality_valid", "domain_counts", "checks", "reason")}, indent=1))
    for s in sessions:
        d = s["domain"]
        print(f"{s['file']}  quality={'ok' if s['quality_valid'] else s['quality_reason']:>18s}  " +
              (f"{d['status']:13s} max|z|={d['max_abs_z']:.2f} z={d['z']}" if d else ""))
    return result


if __name__ == "__main__":
    main()
