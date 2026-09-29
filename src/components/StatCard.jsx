/**
 * StatCard.jsx
 *
 * Metric display for the dashboard. Design intent: neutral, data-forward.
 * The value is the dominant element; the label and trend are secondary.
 * No colored icon backgrounds — icons are inline at low contrast.
 * Trend direction uses a text label + arrow, not color alone.
 */

const TREND_ICON = {
  up:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>,
  down:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>,
  neutral: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

// trend color — only on the badge text, not on backgrounds
const TREND_COLOR = {
  up:      'var(--ns-risk-high-text)',
  down:    'var(--ns-risk-low-text)',
  neutral: 'var(--ns-n500)',
};

export default function StatCard({
  id,
  label,
  value,
  icon,
  trend = 'neutral',
  trendValue,
  trendLabel = 'vs last month',
}) {
  return (
    <article
      id={id}
      role="region"
      aria-label={`${label}: ${value}`}
      style={{
        backgroundColor: 'var(--ns-panel)',
        border: 'var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
      }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-2)' }}>
        <span style={{
          fontSize: 'var(--ts-small)',
          fontWeight: 'var(--fw-medium)',
          color: 'var(--ns-n500)',
          letterSpacing: 'var(--ls-label)',
          lineHeight: 'var(--lh-snug)',
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: 'var(--ns-n400)', lineHeight: 0, flexShrink: 0 }} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      {/* Primary value — data font, large */}
      <div
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 'var(--ts-h1)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--ns-n900)',
          lineHeight: 1,
          letterSpacing: 'var(--ls-tight)',
        }}
        aria-live="polite"
      >
        {value}
      </div>

      {/* Trend badge — text + direction icon */}
      {trendValue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: 'var(--ts-caption)',
            fontWeight: 'var(--fw-medium)',
            color: TREND_COLOR[trend] ?? TREND_COLOR.neutral,
          }}>
            {TREND_ICON[trend] ?? TREND_ICON.neutral}
            {trendValue}
          </span>
          <span style={{ fontSize: 'var(--ts-caption)', color: 'var(--ns-n400)' }}>
            {trendLabel}
          </span>
        </div>
      )}
    </article>
  );
}
