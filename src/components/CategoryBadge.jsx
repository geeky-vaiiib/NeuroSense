/**
 * CategoryBadge.jsx — ASD-friendly category pill badge (Adult / Child / Toddler).
 * Uses muted accent colors with subtle inner borders per master prompt.
 */
const CATEGORY_STYLES = {
  adult: {
    bg: 'var(--color-accent-adult-bg)',
    color: 'var(--color-accent-adult)',
    border: 'var(--color-accent-adult-border)',
    label: 'Adult',
  },
  child: {
    bg: 'var(--color-accent-child-bg)',
    color: 'var(--color-accent-child)',
    border: 'var(--color-accent-child-border)',
    label: 'Child',
  },
  toddler: {
    bg: 'var(--color-accent-toddler-bg)',
    color: 'var(--color-accent-toddler)',
    border: 'var(--color-accent-toddler-border)',
    label: 'Toddler',
  },
};

const SIZE_MAP = {
  sm: { fontSize: '0.6875rem', padding: '3px 10px', dotSize: 5, height: 24 },
  md: { fontSize: '0.75rem', padding: '4px 12px', dotSize: 6, height: 28 },
  lg: { fontSize: '0.8125rem', padding: '5px 14px', dotSize: 7, height: 32 },
};

export default function CategoryBadge({ category, size = 'md' }) {
  const s = CATEGORY_STYLES[category] || CATEGORY_STYLES.adult;
  const sz = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <span
      role="status"
      aria-label={`Category: ${s.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: sz.padding,
        height: sz.height,
        borderRadius: 'var(--radius-full)',
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: sz.fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: sz.dotSize,
          height: sz.dotSize,
          borderRadius: '50%',
          backgroundColor: s.color,
          flexShrink: 0,
          opacity: 0.85,
        }}
      />
      {s.label}
    </span>
  );
}
