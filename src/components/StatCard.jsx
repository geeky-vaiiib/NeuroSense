/**
 * StatCard.jsx
 * A metric display card with trend indicator and optional sparkline slot.
 */

import { useState } from 'react';

const trendColors = {
  up: 'var(--color-risk-high)',
  down: 'var(--color-risk-low)',
  neutral: 'var(--color-neutral-500)',
};

const trendIcons = {
  up: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  down: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  neutral: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

const styles = {
  card: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow var(--duration-normal) var(--ease-out), transform var(--transition-base)',
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontSize: 'var(--text-2xs)',
    fontWeight: 'var(--weight-semibold)',
    letterSpacing: 'var(--tracking-widest)',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-400)',
  },
  value: {
    fontSize: 'var(--text-4xl)',
    fontWeight: 'var(--weight-light)',
    fontFamily: 'var(--font-display)',
    letterSpacing: 'var(--tracking-tight)',
    lineHeight: 1,
    marginBottom: 'var(--space-1)',
    color: 'var(--color-neutral-900)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  trendBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    fontFamily: 'var(--font-mono)',
    borderRadius: 'var(--radius-full)',
    padding: '2px var(--space-2)',
  },
  trendLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-neutral-400)',
    lineHeight: 'var(--leading-relaxed)',
  },
};

/**
 * @param {object} props
 * @param {string}  props.id        - Unique element ID
 * @param {string}  props.label     - Metric label
 * @param {string|number} props.value - Primary metric value
 * @param {React.ReactNode} [props.icon] - Icon element
 * @param {string}  [props.iconBg]  - Icon background CSS color
 * @param {string}  [props.iconColor] - Icon color
 * @param {string}  [props.accentColor] - Color for the left accent pill
 * @param {'up'|'down'|'neutral'} [props.trend]
 * @param {string}  [props.trendValue] - e.g. "+12%"
 * @param {string}  [props.trendLabel] - e.g. "vs last month"
 */
export default function StatCard({
  id,
  label,
  value,
  icon,
  iconBg = 'var(--color-primary-subtle)',
  iconColor = 'var(--color-primary)',
  accentColor = 'var(--color-primary)',
  trend = 'neutral',
  trendValue,
  trendLabel = 'vs last month',
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <article
      id={id}
      role="region"
      aria-label={`${label}: ${value}`}
      style={{
        ...styles.card,
        boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent pill (replaces borderLeft) */}
      <div style={{
        position: 'absolute', top: 16, left: 0,
        width: 3, height: 28,
        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
        background: accentColor,
      }} />

      <div style={styles.header}>
        <div>
          <div style={styles.label}>{label}</div>
        </div>
        {icon && (
          <div style={{ ...styles.iconWrapper, backgroundColor: iconBg, color: iconColor }}>
            {icon}
          </div>
        )}
      </div>

      <div style={styles.value} aria-live="polite">{value}</div>

      {trendValue && (
        <div style={styles.footer}>
          <span
            style={{
              ...styles.trendBadge,
              color: trendColors[trend],
              backgroundColor: `${trendColors[trend]}18`,
            }}
          >
            {trendIcons[trend]}
            {trendValue}
          </span>
          <span style={styles.trendLabel}>{trendLabel}</span>
        </div>
      )}
    </article>
  );
}
