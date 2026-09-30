/**
 * Shown while the backend scores the screening. There is no progress percentage because the
 * backend does not report one; the stage list is descriptive and the motion is indeterminate.
 */
import { NeuroSenseMark } from '../branding/NeuroSenseLogo';

const STAGES = ['Collecting signals', 'Analyzing patterns', 'Combining modalities', 'Generating screening insight'];

export default function AnalysisState() {
  return (
    <div role="status" aria-live="polite" className="ns-dark" style={{ borderRadius: 'var(--r-lg)', padding: 'clamp(28px, 5vw, 48px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(420px 260px at 50% 30%, rgba(34,211,238,0.14), transparent 70%)' }} />
      <div style={{ position: 'relative' }}>
        <NeuroSenseMark size={72} tone="dark" animated />
        <h2 style={{ marginTop: 22, fontSize: '1.35rem' }}>Analyzing screening signals…</h2>
        <p style={{ margin: '8px auto 0', maxWidth: 380, fontSize: '0.9rem' }}>This usually takes a few seconds. Please keep this page open.</p>
        <ol style={{ listStyle: 'none', margin: '26px auto 0', padding: 0, display: 'grid', gap: 10, maxWidth: 320, textAlign: 'left' }}>
          {STAGES.map((s, i) => (
            <li key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem', color: '#C9D5E8' }}>
              <span className="ns-node-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ns-signal)', animationDelay: `${i * 0.35}s` }} aria-hidden="true" />
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
