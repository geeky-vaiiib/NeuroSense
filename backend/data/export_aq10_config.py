"""Export backend-owned AQ-10 wording to React. Does not score in the browser."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if __name__ == '__main__':
    (ROOT / 'src/data/aq10.config.json').write_bytes((ROOT / 'backend/ml/aq10_content.json').read_bytes())
