/**
 * NeuroSense brand marks (pure SVG, scales from 16px favicon to hero size).
 *
 * The symbol is an eye (perception / gaze) whose iris is a small neural graph: four nodes joined
 * as an "N", a bright pupil-node at the centre where the diagonal crosses (the fused signal), and
 * two "corner" nodes at the ends of the lid line. No brain icon, no stock artwork.
 *
 *   <NeuroSenseMark size={32} />                         symbol only
 *   <NeuroSenseLogo variant="full" tone="dark" />        symbol + wordmark (+ descriptor)
 *   animated: nodes pulse and the diagonal carries a slow signal (disabled by reduced motion)
 */
import { useId } from 'react';

const NODES = { a: [17, 31], b: [17, 17], c: [31, 31], d: [31, 17] };

export function NeuroSenseMark({ size = 32, tone = 'light', animated = false, title = 'NeuroSense', tile = false }) {
  const uid = useId().replace(/:/g, '');
  const ink = tone === 'dark' ? '#E6ECF5' : 'var(--ns-n900)';
  const accent = tone === 'dark' ? 'var(--ns-signal)' : 'var(--ns-instrument-light)';
  const faint = tone === 'dark' ? 'rgba(230,236,245,0.35)' : 'rgba(11,18,32,0.28)';
  const { a, b, c, d } = NODES;
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label={title}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`g${uid}`} x1="6" y1="40" x2="42" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--ns-instrument)" />
          <stop offset="1" stopColor="var(--ns-signal)" />
        </linearGradient>
      </defs>
      {tile && <rect width="48" height="48" rx="12" fill="var(--ns-navy-900)" />}
      {/* eye / lid outline */}
      <path
        d="M3.5 24C10.5 11.5 37.5 11.5 44.5 24C37.5 36.5 10.5 36.5 3.5 24Z"
        stroke={tile ? '#E6ECF5' : ink} strokeOpacity={tile ? 0.55 : 0.85} strokeWidth="1.6" strokeLinejoin="round"
      />
      {/* faint links from the eye corners into the graph */}
      <path d={`M3.5 24L${b[0]} ${b[1]}M3.5 24L${a[0]} ${a[1]}M44.5 24L${d[0]} ${d[1]}M44.5 24L${c[0]} ${c[1]}`} stroke={faint} strokeWidth="0.9" />
      {/* the N */}
      <path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${c[0]} ${c[1]}L${d[0]} ${d[1]}`} stroke={`url(#g${uid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {animated && (
        <path className="ns-signal-path" d={`M${b[0]} ${b[1]}L${c[0]} ${c[1]}`} stroke="#fff" strokeOpacity="0.9" strokeWidth="1.2" strokeLinecap="round" />
      )}
      {[a, b, c, d].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.3" fill={tile ? 'var(--ns-navy-900)' : 'var(--ns-panel)'} stroke={`url(#g${uid})`} strokeWidth="1.5" />
      ))}
      {/* eye-corner nodes */}
      <circle cx="3.5" cy="24" r="1.5" fill={tile ? '#E6ECF5' : ink} />
      <circle cx="44.5" cy="24" r="1.5" fill={tile ? '#E6ECF5' : ink} />
      {/* pupil-node: where the streams fuse */}
      <circle className={animated ? 'ns-node-pulse' : undefined} cx="24" cy="24" r="3.1" fill={accent} />
      <circle cx="24" cy="24" r="1.1" fill={tile ? 'var(--ns-navy-900)' : '#fff'} />
    </svg>
  );
}

export function NeuroSenseLogo({
  variant = 'full',            // 'mark' | 'full' | 'stacked'
  size = 32,
  tone = 'light',              // 'light' surface -> dark ink, 'dark' surface -> light ink
  descriptor = false,
  animated = false,
  tile = false,
}) {
  if (variant === 'mark') return <NeuroSenseMark size={size} tone={tone} animated={animated} tile={tile} />;
  const ink = tone === 'dark' ? '#F4F7FB' : 'var(--ns-n900)';
  const sub = tone === 'dark' ? '#8FA3C0' : 'var(--ns-n500)';
  const stacked = variant === 'stacked';
  return (
    <span
      role="img" aria-label="NeuroSense"
      style={{ display: 'inline-flex', flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: stacked ? size * 0.3 : size * 0.34 }}
    >
      <NeuroSenseMark size={size} tone={tone} animated={animated} tile={tile} title="" />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: stacked ? 'center' : 'flex-start', lineHeight: 1 }}>
        <span style={{
          fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: size * 0.5,
          letterSpacing: '0.2em', color: ink, paddingLeft: stacked ? '0.2em' : 0,
        }}>
          NEUROSENSE
        </span>
        {descriptor && (
          <span style={{
            fontFamily: 'var(--font-data)', fontWeight: 500, fontSize: Math.max(size * 0.235, 8),
            letterSpacing: '0.16em', color: sub, marginTop: size * 0.2, textTransform: 'uppercase',
          }}>
            AI-assisted neurodevelopmental screening
          </span>
        )}
      </span>
    </span>
  );
}

export default NeuroSenseLogo;
