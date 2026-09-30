/**
 * Semi-circular indicator for the backend's final screening value (0-1).
 * `value` null renders an explicit "Not available" (never a fabricated number).
 * The arc is a plain visual encoding of `value`; nothing is recomputed here.
 */
import useReducedMotion from '../ui/useReducedMotion';

const LEVEL_COLOR = { Low: '#34D399', Moderate: '#FBBF24', High: '#F87171' };

export default function RiskGauge({ value, level, size = 260, tone = 'dark' }) {
  const reduced = useReducedMotion();
  const has = typeof value === 'number' && Number.isFinite(value);
  const v = has ? Math.min(Math.max(value, 0), 1) : 0;
  const r = 100;
  const c = Math.PI * r;                 // half-circle length
  const color = LEVEL_COLOR[level] || '#22D3EE';
  const track = tone === 'dark' ? 'rgba(148,163,184,0.22)' : 'var(--ns-n200)';
  const text = tone === 'dark' ? '#F4F7FB' : 'var(--ns-n900)';
  const sub = tone === 'dark' ? '#8FA3C0' : 'var(--ns-n500)';
  return (
    <figure style={{ margin: 0, width: size, maxWidth: '100%' }}>
      <svg viewBox="0 0 240 150" width="100%" role="img"
        aria-label={has ? `Overall screening indicator ${(v * 100).toFixed(0)} percent${level ? `, ${level} risk level` : ''}` : 'Overall screening indicator not available'}>
        <path d="M20 130 A100 100 0 0 1 220 130" fill="none" stroke={track} strokeWidth="14" strokeLinecap="round" />
        {has && (
          <path
            d="M20 130 A100 100 0 0 1 220 130" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - v)}
            style={{ '--gauge-empty': c, '--gauge-offset': c * (1 - v), animation: reduced ? 'none' : 'gauge-fill 1.1s cubic-bezier(.2,.7,.2,1) both', filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        )}
        {[0.4, 0.7].map((t) => {              // the backend's default level thresholds, as tick marks
          const a = Math.PI * (1 - t);
          return <line key={t} x1={120 + 88 * Math.cos(a)} y1={130 - 88 * Math.sin(a)} x2={120 + 112 * Math.cos(a)} y2={130 - 112 * Math.sin(a)} stroke={sub} strokeOpacity="0.6" strokeWidth="1.5" />;
        })}
        <text x="120" y="112" textAnchor="middle" fontFamily="var(--font-heading)" fontWeight="600" fontSize={has ? 44 : 22} fill={text} letterSpacing="-1">
          {has ? `${(v * 100).toFixed(0)}` : 'Not available'}
          {has && <tspan fontSize="20" fill={sub} dx="2">%</tspan>}
        </text>
        <text x="120" y="138" textAnchor="middle" fontFamily="var(--font-data)" fontSize="10.5" letterSpacing="2" fill={sub}>OVERALL INDICATOR</text>
      </svg>
    </figure>
  );
}
