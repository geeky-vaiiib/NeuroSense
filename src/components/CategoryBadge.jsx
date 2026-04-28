/**
 * CategoryBadge.jsx — Reusable category pill badge (Adult / Child / Toddler).
 *
 * Usage:
 *   <CategoryBadge category="adult" />
 *   <CategoryBadge category="child" size="sm" />
 *   <CategoryBadge category="toddler" />
 */
const CATEGORY_STYLES = {
  adult: {
    bg: '#E8EDF5',
    color: '#3D5A80',
    dot: '#3D5A80',
    label: 'Adult',
  },
  child: {
    bg: '#FFF3E0',
    color: '#E65100',
    dot: '#FF9800',
    label: 'Child',
  },
  toddler: {
    bg: '#F3E8FD',
    color: '#7B3F9E',
    dot: '#9B59B6',
    label: 'Toddler',
  },
};

const SIZE_MAP = {
  sm: { fontSize: '11px', padding: '1px 8px', dotSize: 5 },
  md: { fontSize: '12px', padding: '2px 10px', dotSize: 6 },
  lg: { fontSize: '13px', padding: '3px 12px', dotSize: 7 },
};

export default function CategoryBadge({ category, size = 'md' }) {
  const s = CATEGORY_STYLES[category] || CATEGORY_STYLES.adult;
  const sz = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: sz.padding,
        borderRadius: '20px',
        backgroundColor: s.bg,
        color: s.color,
        fontSize: sz.fontSize,
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: sz.dotSize,
          height: sz.dotSize,
          borderRadius: '50%',
          backgroundColor: s.dot,
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}
