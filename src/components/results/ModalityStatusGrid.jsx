/**
 * One card per modality with its backend status, whether it is part of the result, and its real measurements.
 * Experimental outputs are labelled as such and visibly separated from the result.
 */
import StatusBadge from '../ui/StatusBadge';
import { outputPct } from '../../utils/caseModalities';

const TONE = { available_scoring_instrument: 'ok', available_validated: 'ok', available_experimental: 'warn',
  failed_quality: 'muted', insufficient_data: 'muted', model_unavailable: 'muted', analysis_failed: 'warn',
  skipped: 'muted', not_provided: 'muted', legacy_recorded: 'muted' };

function qualityLine(s) {
  const q = s.quality;
  if (s.id === 'gaze' && q && q.sample_count != null) return `${q.valid_sample_count}/${q.sample_count} usable frames · ${q.duration_seconds}s · data quality ${Math.round((q.data_quality_score ?? 0) * 100)}%`;
  if (s.id === 'speech' && q?.duration_seconds != null) return `${q.duration_seconds}s recorded`;
  if (s.id === 'facial' && s.measurements) return s.measurements.face_detected ? 'face detected' : 'no face detected';
  if (s.id === 'questionnaire' && s.output) return `score ${s.output.total}/${s.output.max} · threshold ≥ ${s.output.threshold}`;
  return null;
}

export default function ModalityStatusGrid({ states }) {
  return (
    <div className="ns-signal-grid">
      {states.map((s) => {
        const pct = outputPct(s);
        const experimental = s.status === 'available_experimental';
        return (
          <article key={s.id} className="ns-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label={`${s.label}: ${s.status_label}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: '0.98rem' }}>{s.label}</h3>
              <StatusBadge tone={TONE[s.status] || 'muted'}>{s.status_label}</StatusBadge>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: s.in_result ? 'var(--ns-risk-low-text)' : 'var(--ns-n500)' }}>
              {s.in_result ? 'Used for the result' : 'Not used for the result'}
            </p>
            {s.output && s.output.kind === 'screening_score' && (
              <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 600 }}>
                {s.output.total}<span style={{ color: 'var(--ns-n500)', fontSize: '1rem' }}> / {s.output.max}</span>
              </p>
            )}
            {pct && (
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ns-n700)' }}>
                <strong style={{ fontFamily: 'var(--font-data)' }}>{pct}</strong>{' '}
                {experimental ? 'experimental model output — research signal only' : 'value stored by an earlier version'}
              </p>
            )}
            {!pct && !s.output && <p style={{ margin: 0, color: 'var(--ns-n400)', fontWeight: 500 }}>No output</p>}
            {qualityLine(s) && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--ns-n500)' }}><strong style={{ color: 'var(--ns-n700)' }}>Details:</strong> {qualityLine(s)}</p>}
            {s.reason && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--ns-n500)', lineHeight: 1.5 }}>{s.reason}</p>}
            {s.model?.version && <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--ns-n500)', fontFamily: 'var(--font-data)' }}>model {s.model.version}{s.model.validated === false ? ' · not validated' : ''}</p>}
          </article>
        );
      })}
    </div>
  );
}
