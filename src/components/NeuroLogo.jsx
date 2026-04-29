/**
 * NeuroLogo.jsx — Neural node logo mark + wordmark component.
 * Replaces the old green-square-with-N logo.
 *
 * Props:
 *   size     — number (default 32), controls SVG width/height
 *   variant  — "mark" | "full" | "stacked" (default "mark")
 *   color    — "teal" | "white" | "mono" (default "teal")
 */

const COLOR_MAP = {
  teal: '#0ECFC8',
  white: '#FFFFFF',
  mono: '#403C38',
};

const WORDMARK_PRIMARY = {
  teal: 'var(--color-neutral-800)',
  white: '#FFFFFF',
  mono: 'var(--color-neutral-700)',
};

const WORDMARK_ACCENT = {
  teal: 'var(--color-primary-500)',
  white: 'rgba(255,255,255,0.75)',
  mono: 'var(--color-neutral-500)',
};

function NeuralNodeMark({ size, fill }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
      aria-label="NeuroSense logo mark"
    >
      {/* Pulse ring (outermost, decorative) */}
      <circle cx="20" cy="20" r="9" stroke={fill} strokeWidth="0.75" fill="none" opacity="0.35" />

      {/* Connection line 1 — upper right */}
      <path d="M 20 20 Q 28 14 33 10" stroke={fill} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Connection line 2 — lower left */}
      <path d="M 20 20 Q 12 26 7 30" stroke={fill} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Connection line 3 — upper left (thinner, tertiary) */}
      <path d="M 20 20 Q 11 13 6 10" stroke={fill} strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Central node */}
      <circle cx="20" cy="20" r="5.5" fill={fill} />

      {/* Endpoint node 1 — upper right */}
      <circle cx="33" cy="10" r="2.5" fill={fill} />

      {/* Endpoint node 2 — lower left */}
      <circle cx="7" cy="30" r="2.5" fill={fill} />

      {/* Endpoint node 3 — upper left (smaller = tertiary) */}
      <circle cx="6" cy="10" r="1.8" fill={fill} />
    </svg>
  );
}

export default function NeuroLogo({ size = 32, variant = 'mark', color = 'teal' }) {
  const fill = COLOR_MAP[color] || COLOR_MAP.teal;
  const wordPrimary = WORDMARK_PRIMARY[color] || WORDMARK_PRIMARY.teal;
  const wordAccent = WORDMARK_ACCENT[color] || WORDMARK_ACCENT.teal;
  const fontSize = size * 0.45 + 'px';

  const wordmark = (
    <span
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        letterSpacing: '-0.02em',
        fontSize,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <span style={{ color: wordPrimary }}>Neuro</span>
      <span style={{ color: wordAccent }}>Sense</span>
    </span>
  );

  if (variant === 'mark') {
    return <NeuralNodeMark size={size} fill={fill} />;
  }

  if (variant === 'full') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.3 + 'px' }}>
        <NeuralNodeMark size={size} fill={fill} />
        {wordmark}
      </div>
    );
  }

  if (variant === 'stacked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.2 + 'px' }}>
        <NeuralNodeMark size={size} fill={fill} />
        <span style={{ textAlign: 'center' }}>{wordmark}</span>
      </div>
    );
  }

  return <NeuralNodeMark size={size} fill={fill} />;
}
