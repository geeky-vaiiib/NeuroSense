import { isResearchClassification, researchClassScores } from './researchOutputs.js';
/** Export saved server values. No scoring, inference or substitute explanations. */
export async function generatePDF(caseData, explanation = {}, options = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  const clean = (v) => String(v ?? 'Unavailable').replace(/[≥]/g, '>=').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  function line(value, size = 10, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    for (const text of doc.splitTextToSize(clean(value), 170)) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.text(text, 20, y);
      y += size * .5 + 1;
    }
    y += 2;
  }
  function section(title) { y += 4; line(title, 12, true); }
  if (caseData.report) {
    const report = caseData.report;
    line('NeuroSense - Research report', 17, true);
    line(`${report.case_id} | ${report.report_version} | ${report.generated_at}`);
    line(report.provenance);
    line(report.screening_conclusion);
    for (const card of report.modalities) {
      section(card.label);
      line(`${card.status_label} (${card.status})`);
      line(card.inclusion_reason);
      for (const row of card.values) line(`${row.name}: ${row.text}`);
      if (card.output === null) line('Model output: Unavailable');
      for (const limitation of card.limitations) line(limitation, 9);
    }
    section('Questionnaire item scoring');
    for (const item of report.questionnaire?.items ?? []) line(`${item.id}: ${item.answer ?? item.letter} | ${item.points ?? item.point} points`);
    section('How this report was formed');
    for (const text of report.summary) line(text);
    line(report.formatting, 9);
    if (options.save !== false) doc.save(`NeuroSense_Report_${report.case_id}.pdf`);
    return doc;
  }
  line('NeuroSense - Research screening record', 17, true);
  line('Confidential. Research prototype; not clinically validated. Not a diagnosis.', 9);
  line(`Case: ${caseData.id} | Track: ${caseData.categoryLabel ?? caseData.category ?? 'Unavailable'} | Date: ${caseData.screeningDate ?? 'Unavailable'}`);
  line(`Subject: ${caseData.subjectName ?? 'Unavailable'} | Age: ${caseData.category === 'toddler' ? `${caseData.age_months ?? caseData.demo?.ageMonths ?? 'Unavailable'} months` : `${caseData.age ?? 'Unavailable'} years`} | Gender: ${caseData.gender ?? 'Unavailable'}`);
  const basis = caseData.questionnaire_basis;
  section('Questionnaire score - determines the screening result');
  if (basis) {
    line(`${basis.instrument}: ${basis.total_score}/${basis.max_score}; threshold >= ${basis.threshold}.`, 13, true);
    line(basis.interpretation ?? (basis.meets_threshold === true ? 'At or above threshold' : basis.meets_threshold === false ? 'Below threshold' : 'Interpretation unavailable'));
    line(`Scoring version: ${basis.scoring_version ?? caseData.scoring_version}. Historical scores are retained as recorded.`);
    line(`Scoring source: ${basis.source ?? basis.threshold_source ?? 'Unavailable'}`, 8);
    line(basis.notice, 9);
    for (const item of basis.items ?? []) line(`${item.id}: ${item.answer ?? item.letter ?? 'Unavailable'} | points: ${item.points ?? item.point ?? 'Unavailable'}`, 9);
  } else {
    line(`Older record: stored score ${caseData.aq10Score ?? 'Unavailable'}/10. Original scoring basis unavailable; not re-scored.`);
    if (caseData.isMock) line('Historical record marked synthetic. Do not interpret as a measured screening result.');
  }
  line(caseData.interpretation);
  section('Supplementary model output - does not affect the result');
  const model = caseData.questionnaire_model;
  if (model && model.available !== false) {
    line(`${model.model_version ?? model.model_used ?? caseData.modelUsed}: ${model.value ?? model.probability ?? 'Unavailable'}`);
    line(caseData.category === 'toddler' ? 'Preliminary cohort similarity, not a population probability of autism.' : 'Models score-derived dataset labels; not an independently validated clinical probability.');
    for (const caveat of model.caveats ?? []) line(caveat, 9);
  } else line('Model output unavailable for this saved record.');
  section('Other analyses - excluded from the screening result');
  for (const modality of (caseData.modality_states ?? []).filter((m) => m.id !== 'questionnaire')) {
    line(`${modality.label ?? modality.id}: ${modality.status ?? 'Unavailable'}. ${modality.reason ?? ''}`, 9);
    if (isResearchClassification(modality.output)) {
      line(`Predicted class: ${modality.output.label}. Uncalibrated class scores: ${researchClassScores(modality.output).map((row) => `${row.label}: ${row.text}`).join(', ')}. Not autism prediction or a measure of internal feelings.`, 9);
      line(`Model: ${modality.model?.version ?? 'Unavailable'}; input schema: ${modality.model?.schema ?? 'Unavailable'}; weights SHA-256: ${modality.model?.weights_sha256 ?? 'Unavailable'}.`, 8);
    }
  }
  line(`Experimental gaze: ${caseData.gaze_status ?? 'Unavailable'}; output: ${caseData.gaze_score ?? 'Unavailable'}. Not a population autism probability.`, 9);
  if (caseData.gaze_quality) line(`Gaze recording quality (not model confidence): ${JSON.stringify(caseData.gaze_quality)}`, 9);
  if (caseData.gaze_features?.descriptive) line(`Gaze/head movement (degrees, speed degrees/s; not calibrated screen position): ${JSON.stringify(caseData.gaze_features.descriptive)}`, 9);
  if (caseData.gaze_features?.recording_timing) line(`Gaze media timing: ${JSON.stringify(caseData.gaze_features.recording_timing)}`, 9);
  for (const [label, values] of [['Speech acoustic measurements', caseData.speech_features], ['Facial detection / image quality', caseData.facial_features]]) {
    line(`${label}: ${values && Object.keys(values).length ? JSON.stringify(values) : 'Unavailable; no measurements stored'}`, 9);
  }
  section('Questionnaire ML model explanation (SHAP) - explains the model, not the result');
  const e = explanation ?? {};
  line('The item points above explain the questionnaire result. Model attributions explain only a supplementary model; they do not establish cause.', 9);
  if (e.modelExplanation?.available && e.shap?.length) {
    for (const item of e.shap) line(`${item.feature}: ${item.shapValue ?? item.shap_value ?? 'Unavailable'}`, 9);
  } else line('Model explanation unavailable.');
  if (e.modelExplanation?.available && e.lime?.length) {
    section('LIME - supplementary model explanation');
    for (const item of e.lime) line(item.plainEnglish ?? item.feature, 9);
  }
  line('Discuss developmental concerns with a qualified health professional regardless of the score. This report does not establish consent, legal compliance, diagnosis or clinical validation.', 9);
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p); doc.setFontSize(8);
    doc.text(`Research prototype - not a diagnosis | ${p}/${total}`, 20, 285);
  }
  if (options.save !== false) doc.save(`NeuroSense_Report_${caseData.id || 'unknown'}.pdf`);
  return doc;
}
