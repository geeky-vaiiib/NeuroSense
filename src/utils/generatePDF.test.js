import { it, expect, vi } from 'vitest';

const texts = [];
vi.mock('jspdf', () => {
  class JsPDF {
    constructor() { this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 }; }
    setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} setFillColor() {} setLineWidth() {} setCharSpace() {}
    rect() {} roundedRect() {} line() {} circle() {} addPage() {} setPage() {} getNumberOfPages() { return 1; }
    getTextWidth(t) { return String(t).length * 2; }
    splitTextToSize(t) { return [String(t)]; }
    text(t) { texts.push(Array.isArray(t) ? t.join(' ') : String(t)); }
    save(name) { this.saved = name; texts.push(`SAVED:${name}`); }
  }
  return { jsPDF: JsPDF };
});

import { generatePDF } from './generatePDF';

import fixtures from '../test/fixtures/resultsReports.json';

for(const key of Object.keys(fixtures)) {
 it(`${key}: simple and technical PDFs retain the same saved score and provenance`,async()=>{
  const report=fixtures[key]; texts.length=0;
  await generatePDF({report,subjectName:'Long synthetic name '.repeat(12)},null,{save:false});
  const simple=texts.join('\n');
  expect(simple).toContain(report.presentation.score_text);
  expect(simple).toContain(report.presentation.threshold_text);
  expect(simple).toContain('Confidential');
  expect(simple).not.toMatch(/weights_sha256|QA-HASH|pitch_mean|Technical appendix|SHAP|62.5%/);
  texts.length=0;await generatePDF({report},null,{mode:'technical',save:false});
  const detailed=texts.join('\n');expect(detailed).toContain(report.presentation.score_text);expect(detailed).toContain('Technical appendix');
  for(const card of report.modalities)for(const row of card.values || [])expect(detailed).toContain(`${row.display_label || row.name}: ${row.text}`);
  expect(detailed).toContain('not requested or are unavailable');
  if(key==='example'){expect(simple).toContain('Recorded research example');expect(detailed).toContain('separate dataset participants');}
 });
}
it('technical export includes only actual available explanations',async()=>{
 texts.length=0;await generatePDF({report:fixtures.adult},{modelExplanation:{available:true},shap:[{feature:'Real returned attribution',shapValue:.123}]},{mode:'technical',save:false});
 expect(texts.join('\n')).toContain('Real returned attribution: 0.123');
});

it('preserves historical interpretation and explicitly handles names outside the PDF font',async()=>{
 texts.length=0;await generatePDF({report:fixtures.legacy,subjectName:'李明'},null,{mode:'technical',save:false});
 const all=texts.join('\n');expect(all).toContain('Original historical interpretation.');expect(all).toContain('this PDF font cannot represent');expect(all).not.toContain('Name: ??');
});

it('recording stage contract is technical-only, while summaries match both modes',async()=>{
 const report=fixtures.partial;
 for(const mode of ['simple','technical']){
  texts.length=0;await generatePDF({report},null,{mode,save:false});const text=texts.join('\n');
  for(const r of report.presentation.recordings)expect(text).toContain(r.status);
  if(mode==='simple')expect(text).not.toContain('classification status:');
  else expect(text).toContain('classification status: unavailable');
 }
});
