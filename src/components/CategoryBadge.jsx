/**
 * CategoryBadge.jsx — ASD-friendly category pill badge (Adult / Child / Toddler).
 * Uses distinct but harmonious visual identities with icon glyphs.
 */
const CATEGORY_STYLES = {
  adult: {
    bg: 'rgba(56,189,248,0.12)',
    color: 'var(--clr-info)',
    border: 'rgba(56,189,248,0.25)',
    icon: '◈',
    label: 'Adult',
  },
  child: {
    bg: 'var(--clr-primary-dim)',
    color: 'var(--clr-primary)',
    border: 'rgba(14,207,200,0.25)',
    icon: '◇',
    label: 'Child',
  },
  toddler: {
    bg: 'var(--clr-secondary-dim)',
    color: 'var(--clr-secondary)',
    border: 'rgba(123,97,255,0.25)',
    icon: '◉',
    label: 'Toddler',
  },
};

const SIZE_MAP = {
  sm: { fontSize: 'var(--text-2xs)', padding: '2px 8px' },
  md: { fontSize: 'var(--text-xs)', padding: '3px 10px' },
  lg: { fontSize: 'var(--text-sm)', padding: '4px 14px' },
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
        gap: '5px',
        padding: sz.padding,
        borderRadius: 'var(--radius-full)',
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: sz.fontSize,
        fontWeight: 'var(--weight-semibold)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        letterSpacing: 'var(--tracking-wide)',
        transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.85em', lineHeight: 1 }}>{s.icon}</span>
      {s.label}
    </span>
  );
}
