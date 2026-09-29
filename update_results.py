import re

with open('src/pages/Results.jsx', 'r') as f:
    content = f.read()

# Token replacements
replacements = {
    'var(--color-bg-card)': 'var(--ns-panel)',
    'var(--color-neutral-900)': 'var(--ns-n900)',
    'var(--color-neutral-800)': 'var(--ns-n800)',
    'var(--color-neutral-700)': 'var(--ns-n700)',
    'var(--color-neutral-600)': 'var(--ns-n600)',
    'var(--color-neutral-500)': 'var(--ns-n500)',
    'var(--color-neutral-400)': 'var(--ns-n400)',
    'var(--color-neutral-300)': 'var(--ns-n300)',
    'var(--color-neutral-200)': 'var(--border-color)',
    'var(--color-neutral-100)': 'var(--ns-surface-2)',
    'var(--color-primary-dark)': 'var(--ns-instrument)',
    'var(--color-primary)': 'var(--ns-instrument)',
    'var(--color-primary-muted)': 'var(--ns-instrument-dim)',
    'var(--color-risk-high)': 'var(--ns-risk-high)',
    'var(--color-risk-high-border)': 'var(--ns-risk-high-border)',
    'var(--color-risk-high-muted)': 'var(--ns-risk-high-bg)',
    'var(--color-risk-low)': 'var(--ns-signal)',
    'var(--color-risk-low-bg)': 'var(--ns-signal-dim)',
    'var(--color-risk-moderate)': 'var(--ns-risk-mod)',
    'var(--color-risk-moderate-bg)': 'var(--ns-risk-mod-bg)',
    'var(--color-bg)': 'var(--ns-surface-2)',
    'var(--font-mono)': 'var(--font-data)',
    'var(--font-body)': 'inherit',
    'var(--shadow-xs)': 'none',
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Card replacements
# <section style={styles.card}> -> <section className="panel">
content = content.replace('style={styles.card}', 'className="panel"')

# Update specific inline styles to classes
content = re.sub(
    r'style=\{\{\s*backgroundColor:\s*\'var\(--ns-panel\)\',\s*border:\s*\'1px solid var\(--border-color\)\',\s*borderRadius:\s*\'22px\',\s*padding:\s*\'24px\',\s*boxShadow:\s*\'none\',\s*\}\}',
    'className="panel"',
    content
)

# Update inputs/buttons
content = content.replace('id="clinician-notes-input"', 'id="clinician-notes-input"\n              className="field-input"')
content = content.replace('id="download-pdf-btn"', 'id="download-pdf-btn"\n            className="btn btn-secondary"')
content = content.replace('id="save-notes-btn"', 'id="save-notes-btn"\n                  className="btn btn-primary"')

with open('src/pages/Results.jsx', 'w') as f:
    f.write(content)

