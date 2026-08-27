const CONFIG = {
  High: { bg: '#F5DDE2', text: '#B05464', dot: '#B05464' },
  Moderate: { bg: '#F5E4C3', text: '#C98B2E', dot: '#C98B2E' },
  Low: { bg: '#E8F2EB', text: '#4A6B52', dot: '#7C9A85' },
  Escalated: { bg: '#F0E0F5', text: '#7B3F9E', dot: '#7B3F9E' },
};

const FALLBACK = {
  bg: '#F0F0ED',
  text: '#6A6A62',
  dot: '#B0B0A8',
};

const SIZE_MAP = {
  sm: { fontSize: '11px', padding: '2px 8px', dot: 5 },
  md: { fontSize: '12px', padding: '3px 10px', dot: 6 },
  lg: { fontSize: '13px', padding: '4px 12px', dot: 7 },
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
      aria-label={`Risk level: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: metric.padding,
        borderRadius: '20px',
        backgroundColor: cfg.bg,
        color: cfg.text,
        fontSize: metric.fontSize,
        fontWeight: 500,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
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
        }}
      />
      {label}
      {showNumericScore && (
        <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.85 }}>
          {Math.round(score * 100)}%
        </span>
      )}
    </span>
  );
}
