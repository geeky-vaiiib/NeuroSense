import re
with open('backend/tests/test_end_to_end.py', 'r') as f:
    content = f.read()
content = content.replace('client = TestClient(app)\n\ndef test_full_pipeline_smoke():', 'def test_full_pipeline_smoke():\n    with TestClient(app) as client:')
content = content.replace('    response = client.post("/screening/screen", json=payload)', '        response = client.post("/screening/screen", json=payload)')
with open('backend/tests/test_end_to_end.py', 'w') as f:
    f.write(content)
