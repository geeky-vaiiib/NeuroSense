/**
 * The questionnaire screening score as stored by the server: total / max with the threshold marked.
 * Nothing is computed here; `basis` is the backend's questionnaire_basis object.
 */
const BAND_COLOR = { Low: '#34D399', Moderate: '#FBBF24', High: '#F87171' };

export default function ScoreMeter({ basis, level }) {
  const color = BAND_COLOR[level] || '#22D3EE';
  const { total_score: total, max_score: max, threshold, instrument } = basis;
  return (
    <figure style={{ margin: 0, width: 280, maxWidth: '100%', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '-0.04em', color: '#F4F7FB', lineHeight: 1 }}
        aria-label={`Score ${total} out of ${max}`}>
        <span style={{ fontSize: 64 }}>{total}</span><span style={{ fontSize: 26, color: '#8FA3C0' }}> / {max}</span>
      </div>
      <div role="img" aria-label={`Score ${total} of ${max}; threshold ${threshold}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${max}, 1fr)`, gap: 3, marginTop: 14 }}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} style={{ height: 14, borderRadius: 3, background: i < total ? color : 'rgba(148,163,184,0.22)',
            outline: i + 1 === threshold ? '2px solid #F4F7FB' : 'none', outlineOffset: 1 }} />
        ))}
      </div>
      <figcaption style={{ marginTop: 10, fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.08em', color: '#8FA3C0' }}>
        {instrument?.toUpperCase()} · THRESHOLD ≥ {threshold}
      </figcaption>
    </figure>
  );
}
