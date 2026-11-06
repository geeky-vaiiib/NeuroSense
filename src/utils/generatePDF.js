/** Presentation only. Both modes read the same saved backend report. */
export async function generatePDF(caseData, explanation = null, options = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({unit:'mm',format:'a4'});
  const report = caseData.display_report || caseData.report;
  const p = report?.presentation;
  const technical = options.mode === 'technical';
  let y=23;
  const clean = v => String(v ?? 'Unavailable').normalize('NFC').replace(/[≥]/g,'>=').replace(/[≤]/g,'<=').replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x20-\x7E\xA0-\xFF\n]/g,'?');
  function line(text,size=10,bold=false){
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(27,39,64);
    for(const row of doc.splitTextToSize(clean(text),166)){
      if(y+size*.5>267){doc.addPage();y=23;}
      doc.text(row,22,y);y+=size*.48+1.5;
    }
    y+=2;
  }
  function section(title){if(y>243){doc.addPage();y=23;}y+=5;line(title,12,true);}
  line('NEUROSENSE',10,true);line(p?.title || 'Your screening summary',22,true);
  line(`${p?.provenance_label || 'Saved screening'} | ${report?.case_id || caseData.id || 'Reference unavailable'}`,9);
  line(`Report date: ${report?.generated_at?.slice(0,10) || caseData.screeningDate || 'Unavailable'} | Track: ${p?.category || caseData.category || 'Original track unavailable'}`,9);
  if(p?.is_example){section('Recorded research example');line(p.provenance_note,10,true);}
  if(caseData.subjectName)line(/[^\x20-\x7E\xA0-\xFF‘’“”–—]/.test(caseData.subjectName) ? 'Name: Please refer to the saved online record; this PDF font cannot represent all characters in the name.' : `Name: ${caseData.subjectName}`,10);
  section(p?.instrument || 'Saved questionnaire');
  line(p?.outcome || 'Original outcome retained',15,true);
  line(`Questionnaire score: ${p?.score_text || 'Unavailable'} | ${p?.threshold_text || 'Original threshold unavailable'}`,12,true);
  line(p?.meaning || report?.screening_conclusion || caseData.interpretation || 'The original scoring basis is unavailable. This record has not been rescored.');
  section('A helpful next step');line(p?.next_step || 'Discuss this record and any concerns with a qualified health professional.');
  line(p?.notice || 'Screening does not establish a diagnosis. A below-threshold score cannot rule out concerns.',9);
  section('Optional recordings');
  if(p?.recordings?.length){for(const r of p.recordings){line(`${r.label} - ${r.status}`,10,true);line(r.summary,10);}}
  else line('Recording summaries were not stored in this older record. No missing output is treated as a score.');
  line(p?.is_example?'Independent research examples; these are not a combined assessment of one person.':'Optional recordings do not change the questionnaire result.',9);
  if(technical){
    doc.addPage();y=23;line('Technical appendix',19,true);
    line(`Report version: ${report?.report_version || 'Historical record'}; presentation: ${p?.version || 'Original presentation'}`,9);
    line(report?.provenance || 'Original record; no rescoring performed.',9);
    line(`Original saved interpretation: ${report?.screening_conclusion || caseData.interpretation || 'Unavailable'}`,9);
    const q=report?.questionnaire || caseData.questionnaire_basis;
    section('Scoring provenance');line(`Instrument: ${q?.instrument || 'Unavailable'}; scoring version: ${q?.scoring_version ?? caseData.scoring_version ?? 'Unavailable'}`);
    line(`Source: ${q?.source || 'Unavailable'}`,9);
    for(const item of q?.items || [])line(`${item.id}: ${item.answer ?? item.letter ?? 'Unavailable'} | ${item.points ?? item.point ?? 'Unavailable'} points`,9);
    for(const r of p?.recordings || []){if(r.analysis){section(`${r.label}: processing stages`);for(const [key,v] of Object.entries(r.analysis)){if(key!=='output')line(`${key.replaceAll('_',' ')}: ${v ?? 'Unavailable'}`,9);}}}
    for(const card of report?.modalities || caseData.modality_states || []){
      section(card.label || card.id);line(`${card.status_label || card.status} (${card.status})`,10,true);
      line(card.inclusion_reason || card.reason || 'Original inclusion reason unavailable.',9);
      for(const row of card.values || [])line(`${row.display_label || row.name}: ${row.text}`,9);
      if(card.output==null)line('Model output: Unavailable',9);
      for(const limitation of card.limitations || [])line(limitation,9);
    }
    section('Supplementary model explanations');
    line('SHAP/LIME explain a supplementary questionnaire model, not the screening decision or cause of autism.',9);
    if(explanation?.modelExplanation?.available){
      for(const item of explanation.shap || [])line(`${item.feature}: ${item.shapValue ?? item.shap_value ?? 'Unavailable'}`,9);
      for(const item of explanation.lime || [])line(item.plainEnglish || item.feature,9);
      if(!explanation.shap?.length && !explanation.lime?.length)line('No attributions were returned.');
    }else line('Model explanations were not requested or are unavailable.');
  }
  const pages=doc.internal.getNumberOfPages();
  for(let n=1;n<=pages;n++){doc.setPage(n);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(71,85,105);doc.text(`Confidential | ${p?.is_example?'Recorded research example':'Research screening record'} | ${n} / ${pages}`,22,286);}
  if(options.save!==false)doc.save(`NeuroSense_Report_${report?.case_id || caseData.id || 'historical'}_${technical?'technical':'simple'}.pdf`);
  return doc;
}
