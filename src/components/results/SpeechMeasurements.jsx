/** Speech: genuine acoustic measurements and an honest status. No score, no flags. */
export default function SpeechMeasurements({ state, features }) {
  const f = features && Object.keys(features).length ? features : state?.measurements;
  const rows = f ? [
    ['Pitch variability', f.pitch_std != null ? `${f.pitch_std.toFixed(1)} Hz` : '—'],
    ['Mean pitch', f.pitch_mean != null ? `${f.pitch_mean.toFixed(1)} Hz` : '—'],
    ['Voiced fraction', f.voiced_fraction != null ? `${(f.voiced_fraction * 100).toFixed(0)}%` : '—'],
    ['Speech-rate estimate', f.speech_rate != null ? `${f.speech_rate.toFixed(1)} /s` : '—'],
    ['Mean loudness (RMS)', f.energy_mean != null ? f.energy_mean.toFixed(4) : '—'],
  ] : [];
  return (
    <section className="panel" aria-labelledby="speech-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 id="speech-title" style={{ margin: 0 }}>Speech</h3>
          <p style={{ margin: '6px 0 0', color: 'var(--ns-n500)' }}>Acoustic measurements from the recording.</p>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--ns-surface-2)', fontSize: '0.75rem', fontWeight: 600 }}>{state?.status_label || 'Not recorded'}</span>
      </div>
      {rows.length > 0 ? (
        <dl style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--ns-surface-2)', margin: 0 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <dt style={{ color: 'var(--ns-n500)', fontSize: '0.85rem' }}>{k}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 600 }}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={{ margin: 0, color: 'var(--ns-n500)' }}>{state?.reason || 'No speech recording was analysed for this case.'}</p>
      )}
      <p style={{ margin: '12px 0 0', color: 'var(--ns-n500)', fontSize: '0.82rem', lineHeight: 1.6 }}>
        These are descriptive measurements only. No validated speech classifier exists in NeuroSense, so speech produces no screening score and is not used for the result.
      </p>
    </section>
  );
}
