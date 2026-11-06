import './results.css';
/** All wording and outcomes come from the backend's saved-value presentation. */
export default function UnifiedReport({ report, technicalContent, actions }) {
  const p = report.presentation;
  return <section className="screening-summary" aria-label="Unified research report">
    <header className="summary-hero">
      <p className="ns-eyebrow">{p?.provenance_label || 'Saved report'}</p>
      <h1>Your screening summary</h1>
      {p?.is_example && <p className="summary-example" role="note">Recorded research example · {p.provenance_note}</p>}
      <p className="summary-instrument">{p?.instrument || 'Original screening record'}</p>
      <div className="summary-result">
        <div><span className="summary-score" aria-label={p?.score_accessible_label}>{p?.score_text || 'Unavailable'}</span><span className="summary-score-caption">Questionnaire score</span></div>
        <div><h2>{p?.outcome || 'Original outcome retained'}</h2><p>{p?.threshold_text || 'Original threshold unavailable'}</p></div>
      </div>
      <p className="summary-meaning">{p?.meaning || 'The original report is available in Technical details. It has not been rescored.'}</p>
      <p className="summary-notice">{p?.notice || 'Screening does not establish a diagnosis. Discuss concerns with a qualified health professional.'}</p>
    </header>
    {p && <section className="summary-next"><span className="ns-eyebrow">What happens next</span><h2>A helpful next step</h2><p>{p.next_step}</p></section>}
    {actions}
    <section className="summary-recordings" aria-labelledby="recordings-title"><h2 id="recordings-title">Your optional recordings</h2><p>These recordings do not change your questionnaire result.</p>
      <div className="summary-recording-grid">{p?.recordings.map(r => <article key={r.id} aria-label={r.label}><div className="summary-recording-top"><h3>{r.label}</h3><span className="summary-status">{r.status}</span></div><p>{r.summary}</p></article>)}</div>
    </section>
    <details className="summary-disclosure"><summary>View answer breakdown</summary>
      <p>Saved answers and item points explain how the questionnaire score was formed.</p>
      {report.questionnaire?.items?.length ? <ol className="summary-answers">{report.questionnaire.items.map(item => <li key={item.id}><strong>{item.id}</strong> · {item.answer ?? item.letter ?? 'Answer unavailable'} <span>{item.points ?? item.point ?? 'Unavailable'} points</span></li>)}</ol> : <p>Item-level scoring was not stored in this older record.</p>}
    </details>
    <details className="summary-disclosure" data-testid="technical-details"><summary>Technical details</summary>
      <p>Separate research outputs explain what the models did. They do not determine the screening outcome.</p>
      <p>Reference: {report.case_id} · {report.report_version} · {report.generated_at}</p><p>{report.provenance}</p>
      {p?.recordings.filter(r=>r.analysis).map(r=><section key={r.id} className="summary-technical-card"><h3>{r.label}: processing stages</h3><dl>{Object.entries(r.analysis).filter(([key])=>key!=='output').map(([key,v])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{v ?? 'Unavailable'}</dd></div>)}</dl></section>)}
      {report.modalities.map(card => <section key={card.id} className="summary-technical-card" aria-label={card.label}><h3>{card.label}</h3><p>{card.status_label} ({card.status})</p><p>{card.included_in_screening ? 'Used for the questionnaire screening result' : 'Not used for the result'}</p><p>{card.inclusion_reason}</p>
        <ul>{card.values.map((row,i) => <li key={i}>{row.display_label || row.name}: {row.text}</li>)}</ul>
        {card.output === null && <p>Model output: Unavailable</p>}{card.limitations.map((text,i)=><p key={i}>{text}</p>)}
      </section>)}
      <p>Original interpretation: {report.screening_conclusion}</p><p>{report.formatting}</p>{technicalContent}
    </details>
    <p className="summary-reference">Report reference {report.case_id} · {report.generated_at?.slice(0,10)}</p>
  </section>;
}
