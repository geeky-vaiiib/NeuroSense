/**
 * Step progress: "Step 2 of 5" + numbered rail. Purely presentational; `current` is 0-based.
 * (Only real step position is shown -- no simulated percentage.)
 */
export default function ProgressIndicator({ steps, current, tone = 'light' }) {
  const dark = tone === 'dark';
  const total = steps.length;
  return (
    <nav aria-label="Screening progress">
      <p style={{ margin: '0 0 10px', fontFamily: 'var(--font-data)', fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? '#8FA3C0' : 'var(--ns-n500)' }}>
        Step {Math.min(current + 1, total)} of {total} · <span style={{ color: dark ? '#F4F7FB' : 'var(--ns-n900)' }}>{steps[Math.min(current, total - 1)].label}</span>
      </p>
      <ol style={{ display: 'flex', gap: 6, listStyle: 'none', margin: 0, padding: 0, alignItems: 'stretch' }}>
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.id} aria-current={active ? 'step' : undefined} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                height: 4, borderRadius: 4, marginBottom: 8, transition: 'background var(--ease-base)',
                background: done || active ? (dark ? 'var(--ns-signal)' : 'var(--ns-instrument)') : (dark ? 'rgba(148,163,184,0.25)' : 'var(--ns-n200)'),
                opacity: active ? 1 : done ? 0.6 : 1,
              }} />
              <span style={{
                display: 'block', fontSize: '0.72rem', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                color: active ? (dark ? '#F4F7FB' : 'var(--ns-n900)') : (dark ? '#6F82A0' : 'var(--ns-n500)'),
              }}>
                <span style={{ fontFamily: 'var(--font-data)', marginRight: 6, opacity: 0.7 }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="ns-step-label">{s.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <style>{`@media (max-width: 560px){ .ns-step-label{ display:none } }`}</style>
    </nav>
  );
}
