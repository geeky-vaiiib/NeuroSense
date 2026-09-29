/**
 * RiskBadge.jsx
 *
 * Displays a risk level with both a geometric shape AND a text label —
 * never color alone (WCAG 1.4.1 non-text color requirement).
 *
 * Shape language:
 *   High     → filled square  (urgent, definite)
 *   Moderate → filled diamond (transitional)
 *   Low      → filled circle  (resolved, calm)
 */

const CONFIG = {
  High: {
    bg:     'var(--ns-risk-high-bg)',
    border: 'var(--ns-risk-high-border)',
    text:   'var(--ns-risk-high-text)',
    shape:  'square',
    label:  'High',
  },
  Moderate: {
    bg:     'var(--ns-risk-mod-bg)',
    border: 'var(--ns-risk-mod-border)',
    text:   'var(--ns-risk-mod-text)',
    shape:  'diamond',
    label:  'Moderate',
  },
  Low: {
    bg:     'var(--ns-risk-low-bg)',
    border: 'var(--ns-risk-low-border)',
    text:   'var(--ns-risk-low-text)',
    shape:  'circle',
    label:  'Low',
  },
  Escalated: {
    bg:     'rgba(107, 54, 171, 0.08)',
    border: 'rgba(107, 54, 171, 0.22)',
    text:   '#5B2D9B',
    shape:  'square',
    label:  'Escalated',
  },
};

const FALLBACK = {
  bg:     'var(--ns-n100)',
  border: 'var(--ns-n200)',
  text:   'var(--ns-n600)',
  shape:  'circle',
  label:  'Unknown',
};

const SIZE_MAP = {
  sm: { fontSize: 'var(--ts-caption)', padding: '2px 8px',  shapeSize: 6 },
  md: { fontSize: 'var(--ts-small)',   padding: '3px 10px', shapeSize: 7 },
  lg: { fontSize: 'var(--ts-body)',    padding: '5px 12px', shapeSize: 8 },
};

function ShapeIndicator({ shape, size, color }) {
  const s = size;
  if (shape === 'square') {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: s,
          height: s,
          borderRadius: 1,
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
    );
  }
  if (shape === 'diamond') {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: s,
          height: s,
          backgroundColor: color,
          flexShrink: 0,
          transform: 'rotate(45deg)',
          borderRadius: 1,
        }}
      />
    );
  }
  // circle
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: s,
        height: s,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

function normalizeRisk(value) {
  if (!value) return 'Unknown';
  const lower = String(value).toLowerCase();
  if (lower === 'high') return 'High';
  if (lower === 'moderate') return 'Moderate';
  if (lower === 'low') return 'Low';
  if (lower === 'escalated') return 'Escalated';
  return String(value);
}

export default function RiskBadge({ risk, level, size = 'md', showScore = false, score }) {
  const label = normalizeRisk(level ?? risk);
  const cfg = CONFIG[label] ?? FALLBACK;
  const metric = SIZE_MAP[size] ?? SIZE_MAP.md;
  const showNumericScore = showScore && Number.isFinite(score);

  return (
    <span
      role="status"
      aria-label={`Risk level: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: metric.padding,
        borderRadius: 'var(--r-sm)',
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        fontSize: metric.fontSize,
        fontWeight: 'var(--fw-medium)',
        fontFamily: 'var(--font-body)',
        lineHeight: 'var(--lh-tight)',
        whiteSpace: 'nowrap',
        letterSpacing: 'var(--ls-label)',
      }}
    >
      <ShapeIndicator shape={cfg.shape} size={metric.shapeSize} color={cfg.text} />
      {label} risk
      {showNumericScore && (
        <span style={{ fontFamily: 'var(--font-data)', opacity: 0.85, fontSize: '0.9em' }}>
          {Math.round(score * 100)}%
        </span>
      )}
    </span>
  );
}
