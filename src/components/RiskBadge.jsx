/**
 * RiskBadge — Reusable pill badge for neurodevelopmental risk levels.
 *
 * Usage:
 *   import RiskBadge from '../components/RiskBadge';
 *
 *   <RiskBadge risk="High" />
 *   <RiskBadge risk="Moderate" />
 *   <RiskBadge risk="Low" />
 *   <RiskBadge risk="Escalated" />
 *
 * Props:
 *   risk  {string}  — "High" | "Moderate" | "Low" | "Escalated"
 *
 * Renders a pill: [colored dot] [risk label]
 */

import React from 'react';

/* ── Colour map ───────────────────────────────────────────── */
const CONFIG = {
  High: {
    bg:   '#F5DDE2',
    text: '#B05464',
    dot:  '#B05464',
  },
  Moderate: {
    bg:   '#F5E4C3',
    text: '#C98B2E',
    dot:  '#C98B2E',
  },
  Low: {
    bg:   '#E8F2EB',
    text: '#4A6B52',
    dot:  '#7C9A85',
  },
  Escalated: {
    bg:   '#F0E0F5',
    text: '#7B3F9E',
    dot:  '#7B3F9E',
  },
};

/* ── Fallback for unknown values ──────────────────────────── */
const FALLBACK = {
  bg:   '#F0F0ED',
  text: '#6A6A62',
  dot:  '#B0B0A8',
};

/* ── Component ────────────────────────────────────────────── */
export default function RiskBadge({ risk }) {
  const label = risk ?? 'Unknown';
  const cfg   = CONFIG[label] ?? FALLBACK;

  return (
    <span
      role="status"
      aria-label={`Risk level: ${label}`}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          '5px',
        padding:      '2px 10px',
        borderRadius: '20px',
        backgroundColor: cfg.bg,
        color:        cfg.text,
        fontSize:     '12px',
        fontWeight:   500,
        fontFamily:   "'DM Sans', system-ui, sans-serif",
        lineHeight:   1.6,
        whiteSpace:   'nowrap',
        userSelect:   'none',
      }}
    >
      {/* Coloured indicator dot */}
      <span
        aria-hidden="true"
        style={{
          display:         'inline-block',
          width:           '6px',
          height:          '6px',
          borderRadius:    '50%',
          backgroundColor: cfg.dot,
          flexShrink:      0,
        }}
      />
      {label}
    </span>
  );
}
