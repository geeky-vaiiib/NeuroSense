/**
 * RiskBadge.jsx — ASD-friendly risk level pill with muted colors.
 * Never uses bright/jarring reds — all colors are desaturated and calm.
 */
const CONFIG = {
  High: {
    bg: 'var(--color-risk-high-muted)',
    text: 'var(--color-risk-high)',
    border: 'var(--color-risk-high-border)',
    dot: 'var(--color-risk-high)',
  },
  Moderate: {
    bg: 'var(--color-risk-moderate-muted)',
    text: 'var(--color-risk-moderate)',
    border: 'var(--color-risk-moderate-border)',
    dot: 'var(--color-risk-moderate)',
  },
  Low: {
    bg: 'var(--color-risk-low-muted)',
    text: 'var(--color-risk-low)',
    border: 'var(--color-risk-low-border)',
    dot: 'var(--color-risk-low)',
  },
  Escalated: {
    bg: 'var(--color-accent-toddler-bg)',
    text: 'var(--color-accent-toddler)',
    border: 'var(--color-accent-toddler-border)',
    dot: 'var(--color-accent-toddler)',
  },
};

const FALLBACK = {
  bg: 'var(--color-neutral-100)',
  text: 'var(--color-neutral-600)',
  border: 'var(--color-neutral-200)',
  dot: 'var(--color-neutral-400)',
};

const SIZE_MAP = {
  sm: { fontSize: '0.6875rem', padding: '3px 10px', dot: 5, height: 24 },
  md: { fontSize: '0.75rem', padding: '4px 12px', dot: 6, height: 28 },
  lg: { fontSize: '0.8125rem', padding: '5px 14px', dot: 7, height: 32 },
};

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
      aria-label={`Risk level: ${label}${showNumericScore ? ` (${Math.round(score * 100)}%)` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: metric.padding,
        height: metric.height,
        borderRadius: 'var(--radius-full)',
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        fontSize: metric.fontSize,
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
          width: metric.dot,
          height: metric.dot,
          borderRadius: '50%',
          backgroundColor: cfg.dot,
          flexShrink: 0,
          opacity: 0.85,
        }}
      />
      {label}
      {showNumericScore && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          opacity: 0.8,
          fontWeight: 500,
        }}>
          {Math.round(score * 100)}%
        </span>
      )}
    </span>
  );
}
