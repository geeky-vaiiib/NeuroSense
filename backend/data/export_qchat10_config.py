"""Write the canonical Q-CHAT-10 display config consumed by the React app (src/data/qchat10.config.json).

backend/ml/qchat10.py stays the single source of truth; a test fails if this file is stale.  Run:
    PYTHONPATH=backend python3 backend/data/export_qchat10_config.py
"""
import json
from pathlib import Path

from ml import qchat10 as Q

OUT = Path(__file__).resolve().parents[2] / "src" / "data" / "qchat10.config.json"


def build() -> dict:
    return {
        "instrument": Q.INSTRUMENT_NAME, "ageMonthsMin": Q.AGE_MONTHS_MIN, "ageMonthsMax": Q.AGE_MONTHS_MAX,
        "maxScore": Q.MAX_SCORE, "officialThreshold": Q.OFFICIAL_THRESHOLD,
        "wordingSource": "Autism Research Centre Q-CHAT-10 form (official English wording; not paraphrased). Helper lines are NeuroSense-authored and shown separately.",
        "items": [{"id": i.id, "qchat25": i.qchat25, "text": i.text, "helper": i.helper, "short": i.short,
                   "options": [{"value": l, "label": lab} for l, lab in zip(Q.LETTERS, i.options)]} for i in Q.ITEMS],
    }


if __name__ == "__main__":
    OUT.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n")
    print("wrote", OUT)
