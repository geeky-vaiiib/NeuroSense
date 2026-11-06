/** Render the immutable backend presentation contract. No scoring or rounding here. */
export default function UnifiedReport({ report }) {
  return <section aria-label="Unified research report" style={{ display: 'grid', gap: 16, overflowWrap: 'anywhere' }}>
    <header className="panel">
      <h1>Research report</h1>
      <p>{report.provenance}</p>
      <p>Case: {report.case_id} · {report.report_version} · {report.generated_at}</p>
      <p>{report.screening_conclusion}</p>
    </header>
    {report.modalities.map((card) => <article className="panel" key={card.id} aria-label={card.label}>
      <h2>{card.label}</h2><p><strong>{card.status_label}</strong> ({card.status})</p>
      <p>{card.included_in_screening ? 'Used for the questionnaire screening result' : 'Not used for the result'}</p><p>{card.inclusion_reason}</p>
      <ul>{card.values.map((row, i) => <li key={`${row.name}-${i}`} aria-label={row.accessible_label || undefined}>{row.name}: {row.text}</li>)}</ul>
      {card.output === null && <p>Model output: Unavailable</p>}
      {card.limitations.map((text, i) => <p key={i}>{text}</p>)}
    </article>)}
    <section className="panel" aria-label="How this report was formed"><h2>How this report was formed</h2>
      {report.summary.map((text, i) => <p key={i}>{text}</p>)}
      <p>{report.formatting}</p>
    </section>
  </section>;
}
