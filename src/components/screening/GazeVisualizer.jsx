/**
 * Decorative animated eye + scan path used on the gaze intro/analysis screens.
 * It does not display measurements; live tracking status is shown by GazeSession itself.
 */
import useReducedMotion from '../ui/useReducedMotion';

export default function GazeVisualizer({ size = 168, tone = 'light' }) {
  const reduced = useReducedMotion();
  const dark = tone === 'dark';
  const ink = dark ? '#E6ECF5' : 'var(--ns-n800)';
  const path = 'M30 96 L62 60 L96 84 L128 44 L150 70';
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 180 112" role="img" aria-label="Eye following a scan path" style={{ overflow: 'visible' }}>
      <path d="M6 56C34 14 146 14 174 56C146 98 34 98 6 56Z" fill="none" stroke={ink} strokeOpacity="0.7" strokeWidth="1.8" />
      <circle cx="90" cy="56" r="24" fill="none" stroke="var(--ns-instrument-light)" strokeWidth="1.6" strokeOpacity="0.8" />
      <circle cx="90" cy="56" r="10" fill="var(--ns-instrument-light)" className={reduced ? undefined : 'ns-node-pulse'} />
      <path d={path} fill="none" stroke="var(--ns-signal)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 6" className={reduced ? undefined : 'ns-signal-path'} />
      {[[30, 96], [62, 60], [96, 84], [128, 44], [150, 70]].map(([x, y], i) => (<circle key={i} cx={x} cy={y} r="3.2" fill="var(--ns-signal)" opacity={0.5 + i * 0.1} />))}
      {!reduced && <circle r="4.5" fill="#fff" stroke="var(--ns-signal)" strokeWidth="1.5"><animateMotion dur="6s" repeatCount="indefinite" path={path} /></circle>}
    </svg>
  );
}
