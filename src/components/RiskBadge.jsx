/**
 * RiskBadge.jsx
 * Semantic risk level indicator — high (rose), moderate (amber), low (sage).
 */

import React from 'react';

const RISK_CONFIG = {
  high: {
    label: 'High Risk',
    color: 'var(--color-risk-high)',
    bg: 'var(--color-risk-high-muted)',
    border: 'var(--color-risk-high-border)',
    dot: 'var(--color-risk-high)',
    pulse: true,
  },
  moderate: {
    label: 'Moderate',
    color: 'var(--color-risk-moderate)',
    bg: 'var(--color-risk-moderate-muted)',
    border: 'var(--color-risk-moderate-border)',
    dot: 'var(--color-risk-moderate)',
    pulse: false,
  },
  low: {
    label: 'Low Risk',
    color: 'var(--color-risk-low)',
    bg: 'var(--color-risk-low-muted)',
    border: 'var(--color-risk-low-border)',
    dot: 'var(--color-risk-low)',
    pulse: false,
  },
};

const SIZE_STYLES = {
  sm: { fontSize: 'var(--font-size-xs)', padding: '3px 8px', dotSize: '6px', gap: '5px' },
  md: { fontSize: 'var(--font-size-sm)', padding: '4px 10px', dotSize: '7px', gap: '6px' },
  lg: { fontSize: 'var(--font-size-base)', padding: '6px 14px', dotSize: '8px', gap: '7px' },
};

/**
 * @param {object} props
 * @param {'high'|'moderate'|'low'} props.level - Risk level
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.showScore] - Show numeric score alongside label
 * @param {number} [props.score] - 0–1 risk score
 * @param {boolean} [props.showLabel=true]
 */
export default function RiskBadge({ level = 'low', size = 'md', showScore = false, score, showLabel = true }) {
  const config = RISK_CONFIG[level] ?? RISK_CONFIG.low;
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      role="status"
      aria-label={`${config.label}${showScore && score != null ? ` (${Math.round(score * 100)}%)` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyle.gap,
        padding: sizeStyle.padding,
        borderRadius: 'var(--radius-full)',
        fontSize: sizeStyle.fontSize,
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-mono)',
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        letterSpacing: 'var(--letter-spacing-wide)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Status dot */}
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: sizeStyle.dotSize,
          height: sizeStyle.dotSize,
          borderRadius: 'var(--radius-full)',
          backgroundColor: config.dot,
          flexShrink: 0,
          animation: config.pulse ? 'pulse-dot 1.8s ease-in-out infinite' : 'none',
        }}
      />

      {showLabel && config.label}

      {showScore && score != null && (
        <span style={{ opacity: 0.75 }}>
          {Math.round(score * 100)}%
        </span>
      )}

      {/* Pulse keyframe injected via style tag — no external CSS needed */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </span>
  );
}
