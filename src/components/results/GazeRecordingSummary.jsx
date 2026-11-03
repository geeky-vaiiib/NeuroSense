/**
 * Real recording quality + plain movement measurements for one gaze recording.
 * Shown whether or not the gaze classifier is eligible. Nothing here is a diagnostic indicator.
 */
const row = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.85rem', padding: '3px 0' };
const pct = (v) => Number.isFinite(v) ? `${Math.round(v * 100)}%` : 'Unavailable';
const fixed = (v) => Number.isFinite(v) ? v.toFixed(1) : 'Unavailable';
const num = { fontFamily: 'var(--font-data)', color: 'var(--ns-n900)', fontWeight: 600, textAlign: 'right' };

export default function GazeRecordingSummary({ quality, descriptive, timing }) {
  if (!quality && !descriptive && !timing) return null;
  const chans = descriptive?.channels ? Object.values(descriptive.channels) : [];
  return (
    <div style={{ marginTop: 18, padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', backgroundColor: 'var(--ns-surface-2)' }}
      aria-label="Gaze recording summary">
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ns-n800)' }}>Recording summary</p>
      <p>Quality is tracking/data quality, not model confidence or diagnostic accuracy. Gaze angles are not calibrated screen position, eye-contact time or stimulus attention. Experimental output is excluded from the questionnaire result.</p>
      {timing && <p>Media duration: {fixed(timing.duration_s)} s (last-frame interval estimated); cadence: {fixed(timing.fps)} frames/s. Constant-cadence approximation from media timestamps; no screen calibration.</p>}
      {quality && (
        <div>
          <div style={row}><span>Usable frames</span><span style={num}>{quality.valid_sample_count ?? 'Unavailable'} / {quality.sample_count ?? 'Unavailable'} ({pct(quality.valid_sample_ratio)})</span></div>
          <div style={row}><span>Usable tracked span</span><span style={num}>{quality.duration_seconds != null ? `${quality.duration_seconds}s` : 'Unavailable'}</span></div>
          <div style={row}><span>Tracking continuity</span><span style={num}>{pct(quality.tracking_continuity)}</span></div>
          <div style={row}><span>Face-tracking confidence</span><span style={num}>{quality.mean_confidence != null ? quality.mean_confidence.toFixed(2) : '—'}</span></div>
          <div style={row}><span>Recording data quality</span><span style={num}>{pct(quality.data_quality_score)}</span></div>
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
                  <td style={num}>{fixed(c.std_deg)}°</td><td style={num}>{fixed(c.typical_range_deg)}°</td><td style={num}>{fixed(c.mean_speed_deg_per_s)}°</td>
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
