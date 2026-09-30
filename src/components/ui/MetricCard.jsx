import StatusBadge from './StatusBadge';

/** One number that matters. `value` null renders an explicit "Unavailable" (never a placeholder figure). */
export default function MetricCard({ label, value, unit, hint, status, statusTone, icon, unavailableText = 'Unavailable' }) {
  const has = value !== null && value !== undefined && value !== '';
  return (
    <div className="ns-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ns-n500)', letterSpacing: '0.02em' }}>{label}</span>
        {icon && <span style={{ color: 'var(--ns-n400)', display: 'flex' }} aria-hidden="true">{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minHeight: 40 }}>
        {has ? (
          <>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--ns-n900)' }}>{value}</span>
            {unit && <span style={{ fontSize: '0.85rem', color: 'var(--ns-n500)' }}>{unit}</span>}
          </>
        ) : (
          <span style={{ fontSize: '0.95rem', color: 'var(--ns-n400)', fontWeight: 500 }}>{unavailableText}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
        {status && <StatusBadge tone={statusTone || 'muted'}>{status}</StatusBadge>}
        {hint && <span style={{ fontSize: '0.78rem', color: 'var(--ns-n500)' }}>{hint}</span>}
      </div>
    </div>
  );
}
