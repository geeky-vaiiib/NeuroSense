/**
 * RiskBadge.jsx — ASD-friendly risk level pill with muted colors.
 * Never uses bright/jarring reds — all colors are desaturated and calm.
 */
const CONFIG = {
  High: {
    bg: 'var(--clr-danger-dim)',
    text: 'var(--clr-danger)',
    border: 'rgba(239,68,68,0.25)',
    dot: 'var(--clr-danger)',
  },
  Moderate: {
    bg: 'var(--clr-warning-dim)',
    text: 'var(--clr-warning)',
    border: 'rgba(245,158,11,0.25)',
    dot: 'var(--clr-warning)',
  },
  Low: {
    bg: 'var(--clr-success-dim)',
    text: 'var(--clr-success)',
    border: 'rgba(34,197,94,0.25)',
    dot: 'var(--clr-success)',
  },
  Escalated: {
    bg: 'var(--clr-secondary-dim)',
    text: 'var(--clr-secondary)',
    border: 'rgba(123,97,255,0.25)',
    dot: 'var(--clr-secondary)',
  },
};

const FALLBACK = {
  bg: 'var(--clr-surface-2)',
  text: 'var(--clr-text-secondary)',
  border: 'var(--clr-border)',
  dot: 'var(--clr-text-muted)',
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
  const isLg = size === 'lg';
  const isSm = size === 'sm';
  const showNumericScore = showScore && score !== undefined && Number.isFinite(score);

  return (
    <span
      role="status"
      aria-label={`Risk level: ${label}${showNumericScore ? ` (${score.toFixed(2)})` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: isLg ? '4px 12px' : isSm ? '2px 8px' : '3px 10px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        fontSize: isLg ? 'var(--text-sm)' : 'var(--text-2xs)',
        fontWeight: 'var(--weight-semibold)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        letterSpacing: 'var(--tracking-wide)',
        transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Status dot */}
      <span
        aria-hidden="true"
        style={{
          width: 5,
          height: 5,
          borderRadius: 'var(--radius-full)',
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      {label}
      {showNumericScore && (
        <>
          <span style={{ opacity: 0.4, margin: '0 2px' }}>·</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9em',
          }}>
            {score.toFixed(2)}
          </span>
        </>
      )}
    </span>
  );
}
