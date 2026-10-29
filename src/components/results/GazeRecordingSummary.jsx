/**
 * Real recording quality + plain movement measurements for one gaze recording.
 * Shown whether or not the gaze classifier is eligible. Nothing here is a diagnostic indicator.
 */
const row = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.85rem', padding: '3px 0' };
const num = { fontFamily: 'var(--font-data)', color: 'var(--ns-n900)', fontWeight: 600, textAlign: 'right' };

export default function GazeRecordingSummary({ quality, descriptive }) {
  if (!quality && !descriptive) return null;
  const chans = descriptive?.channels ? Object.values(descriptive.channels) : [];
  return (
    <div style={{ marginTop: 18, padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', backgroundColor: 'var(--ns-surface-2)' }}
      aria-label="Gaze recording summary">
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ns-n800)' }}>Recording summary</p>
      {quality && (
        <div>
          <div style={row}><span>Usable frames</span><span style={num}>{quality.valid_sample_count} / {quality.sample_count} ({Math.round((quality.valid_sample_ratio ?? 0) * 100)}%)</span></div>
          <div style={row}><span>Duration</span><span style={num}>{quality.duration_seconds}s</span></div>
          <div style={row}><span>Tracking continuity</span><span style={num}>{Math.round((quality.tracking_continuity ?? 0) * 100)}%</span></div>
          <div style={row}><span>Face-tracking confidence</span><span style={num}>{quality.mean_confidence != null ? quality.mean_confidence.toFixed(2) : '—'}</span></div>
          <div style={row}><span>Recording data quality</span><span style={num}>{Math.round((quality.data_quality_score ?? 0) * 100)}%</span></div>
        </div>
      )}
      {chans.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.82rem', color: 'var(--ns-n600)' }}>Movement during the recording (degrees)</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ color: 'var(--ns-n500)', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', fontWeight: 600 }}>Measure</th><th style={{ fontWeight: 600 }}>Variability (SD)</th>
                <th style={{ fontWeight: 600 }}>Typical range</th><th style={{ fontWeight: 600 }}>Avg speed /s</th>
              </tr>
            </thead>
            <tbody>
              {chans.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  <td style={num}>{c.std_deg.toFixed(1)}°</td><td style={num}>{c.typical_range_deg.toFixed(1)}°</td><td style={num}>{c.mean_speed_deg_per_s.toFixed(1)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '8px 0 0', color: 'var(--ns-n500)', fontSize: '0.78rem', lineHeight: 1.5 }}>{descriptive.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
