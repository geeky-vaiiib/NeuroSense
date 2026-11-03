import { describe, it, expect, vi } from 'vitest';

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

describe('PDF report', () => {
  it('prints the server score, threshold and honest explanation scope; never "fusion risk score" or NaN', async () => {
    texts.length = 0;
    const caseData = { id: 'NS-C-1', category: 'child', categoryLabel: 'Child', subjectName: 'T', age: 7, gender: 'Male', riskLevel: 'High',
      riskScore: null, aq10Score: 8, screeningTool: 'Child AQ-10', modelUsed: 'child_AdaBoostClassifier', dataSource: 'score_rule+model',
      screeningDate: '2026-10-29', interpretation: 'High concentration of traits.',
      questionnaire_basis: { total_score: 8, max_score: 10, threshold: 7, instrument: 'AQ-10 (child, caregiver-completed)' } };
    await generatePDF(caseData, { shap: [{ feature: 'Item', shapValue: 0.1, direction: 'positive' }], lime: [], summary: 'x' });
    const all = texts.join('\n');
    expect(all).toMatch(/8\/10/);
    expect(all).toMatch(/threshold >= 7/);
    expect(all).toMatch(/explains the model, not the result/);
    expect(all).not.toMatch(/NaN|FUSION RISK SCORE/);
    expect(texts.some((t) => t.startsWith('SAVED:'))).toBe(true);
  });
});

it('exports toddler provenance and unavailable model without risk tiers or fabricated explanations', async()=>{
  texts.length=0;
  await generatePDF({id:'T',category:'toddler',age_months:20,scoring_version:3,
    questionnaire_basis:{instrument:'Q-CHAT-10',total_score:3,max_score:10,threshold:3,scoring_version:3,meets_threshold:true,items:[]},
    questionnaire_model:null,modality_states:[{id:'gaze',status:'skipped'}]},null);
  const all=texts.join('\n');
  expect(all).toContain('20 months'); expect(all).toContain('threshold >= 3');
  expect(all).toContain('Model output unavailable'); expect(all).toContain('skipped');
  expect(all).not.toMatch(/HIGH RISK|Clinical Use Only|top reasons.*risk classification|NaN/);
});

it('exports media timing and separates recording quality from model confidence',async()=>{
 texts.length=0;
 await generatePDF({id:'fixture',category:'child',gaze_quality:{data_quality_score:0},gaze_features:{recording_timing:{duration_s:30,timing_source:'decoded_media_pts',normalization_version:'media-pts-cfr-v1'}}},null);
 const all=texts.join('\n');expect(all).toContain('not model confidence');expect(all).toContain('media-pts-cfr-v1');expect(all).toContain('"duration_s":30');expect(all).not.toContain('undefined');
});
