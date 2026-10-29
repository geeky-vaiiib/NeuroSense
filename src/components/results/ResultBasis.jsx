/** States exactly what produced the result, as reported by the backend (no recalculation). */
export default function ResultBasis({ result }) {
  if (!result) return null;
  return (
    <dl style={{ display: 'grid', gap: 12, margin: 0, color: '#C9D5E8', fontSize: '0.9rem', lineHeight: 1.6 }}>
      <div><dt style={{ color: '#8FA3C0', fontSize: '0.74rem', letterSpacing: '0.08em' }}>RULE</dt><dd style={{ margin: 0 }}>{result.formula}</dd></div>
      <div><dt style={{ color: '#8FA3C0', fontSize: '0.74rem', letterSpacing: '0.08em' }}>USED</dt><dd style={{ margin: 0 }}>{result.modalities_in_result.join(', ')} — total {result.total_score}/{result.max_score}, threshold ≥ {result.threshold}</dd></div>
      <div><dt style={{ color: '#8FA3C0', fontSize: '0.74rem', letterSpacing: '0.08em' }}>NOT USED</dt>
        <dd style={{ margin: 0 }}>{result.excluded.length ? result.excluded.map((e) => `${e.id} (${e.status_label})`).join(' · ') : 'none'}</dd></div>
      <div><dt style={{ color: '#8FA3C0', fontSize: '0.74rem', letterSpacing: '0.08em' }}>COMPOSITE PROBABILITY</dt><dd style={{ margin: 0 }}>None. There is no combined probability or weighting: experimental and unavailable signals cannot change this result.</dd></div>
    </dl>
  );
}
