import re

with open('src/pages/Results.jsx', 'r') as f:
    content = f.read()

# Start a screening button
content = re.sub(
    r'<\s*button\s*onClick=\{\(\) => navigate\(\'/app/screening\'\)\}\s*style=\{\{[^}]+\}\}\s*>',
    '<button onClick={() => navigate(\'/app/screening\')} className="btn btn-primary">',
    content
)

# Download PDF button
content = re.sub(
    r'<\s*button\s*id="download-pdf-btn"\s*className="btn btn-secondary"\s*onClick=\{handleDownloadPDF\}\s*disabled=\{[^}]+\}\s*style=\{\{[^}]+\}\}\s*>',
    '<button id="download-pdf-btn" onClick={handleDownloadPDF} disabled={pdfLoading || !selectedCase || !explanation} className="btn btn-secondary">',
    content
)

# Save Notes button
content = re.sub(
    r'<\s*button\s*id="save-notes-btn"\s*className="btn btn-primary"\s*onClick=\{handleSaveNotes\}\s*style=\{\{[^}]+\}\}\s*>',
    '<button id="save-notes-btn" onClick={handleSaveNotes} className="btn btn-primary">',
    content
)

# Fix clinician notes textarea
content = re.sub(
    r'<\s*textarea\s*id="clinician-notes-input"\s*className="field-input"\s*value=\{clinicianNotes\}\s*onChange=\{[^\}]+\}\s*placeholder="[^"]+"\s*rows=\{5\}\s*style=\{\{[^\}]+\}\}\s*onFocus=\{[^\}]+\}\s*onBlur=\{[^\}]+\}\s*/>',
    '<textarea id="clinician-notes-input" className="field-input" value={clinicianNotes} onChange={(e) => { setClinicianNotes(e.target.value); setNotesSaved(false); }} placeholder="Add clinical observations, referral notes, or follow-up plans here…" rows={4} style={{ minHeight: \'100px\', resize: \'vertical\' }} />',
    content
)

with open('src/pages/Results.jsx', 'w') as f:
    f.write(content)
