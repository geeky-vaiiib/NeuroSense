/**
 * CategoryBadge.jsx
 *
 * Displays the screening track (Adult, Child, Toddler).
 * Designed to be extremely quiet (neutral gray scale) so it never
 * competes with the RiskBadge colors for attention.
 */

const CATEGORY_LABEL = {
  adult: 'Adult track',
  child: 'Child track',
  toddler: 'Toddler track',
};

const SIZE_MAP = {
  sm: { fontSize: 'var(--ts-caption)', padding: '2px 6px' },
  md: { fontSize: 'var(--ts-small)',   padding: '3px 8px' },
  lg: { fontSize: 'var(--ts-body)',    padding: '4px 10px' },
};

export default function CategoryBadge({ category, size = 'md' }) {
  const label = CATEGORY_LABEL[category] || 'Unknown track';
  const sz = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: sz.padding,
        borderRadius: 'var(--r-sm)',
        backgroundColor: 'var(--ns-surface-2)',
        border: 'var(--border)',
        color: 'var(--ns-n600)',
        fontSize: sz.fontSize,
        fontWeight: 'var(--fw-medium)',
        lineHeight: 'var(--lh-tight)',
        whiteSpace: 'nowrap',
        letterSpacing: 'var(--ls-label)',
      }}
    >
      {label}
    </span>
  );
}
