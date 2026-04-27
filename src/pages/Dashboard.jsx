/**
 * Dashboard.jsx — NeuroSense ASD Screening Overview
 *
 * Sections:
 *  1. Page header
 *  2. 4-column StatCard grid (Screenings Today, High Risk Flags, Avg Fusion Score, XAI Reports Ready)
 *  3. Modality Confidence horizontal progress bars
 *  4. Recent Cases table with RiskBadge pills
 *
 * All data from mockData.js · All colours from tokens.css · Zero external libs.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_CASES, STAT_CARDS, MODALITY_CONFIDENCE } from '../data/mockData';

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const RISK_CONFIG = {
  high:     { label: 'High',     bg: 'var(--color-risk-high-muted)',     color: 'var(--color-risk-high)',     border: 'var(--color-risk-high-border)' },
  moderate: { label: 'Moderate', bg: 'var(--color-risk-moderate-muted)', color: 'var(--color-risk-moderate)', border: 'var(--color-risk-moderate-border)' },
  low:      { label: 'Low',      bg: 'var(--color-risk-low-muted)',      color: 'var(--color-risk-low)',      border: 'var(--color-risk-low-border)' },
};

const STATUS_CONFIG = {
  reviewed:       { label: 'Reviewed',       color: 'var(--color-primary-dark)' },
  'pending-review':{ label: 'Pending Review', color: 'var(--color-risk-moderate)' },
  'in-progress':  { label: 'In Progress',    color: '#4A90B8' },
  closed:         { label: 'Closed',         color: 'var(--color-neutral-500)' },
};

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────
   1.  StatCard
───────────────────────────────────────────────────────────── */
function StatCard({ id, label, value, borderColor, href }) {
  const [hov, setHov] = useState(false);
  const navigate = useNavigate();
  const clickable = Boolean(href);

  return (
    <div
      id={id}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${label}: ${value} — view cases` : undefined}
      onClick={() => clickable && navigate(href)}
      onKeyDown={(e) => e.key === 'Enter' && clickable && navigate(href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: `1px solid ${hov && clickable ? borderColor : 'var(--color-neutral-200)'}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 'var(--radius-xl)',
        padding: '22px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: hov && clickable ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        cursor: clickable ? 'pointer' : 'default',
        transform: hov && clickable ? 'translateY(-2px)' : 'none',
        transition: 'all var(--transition-fast)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Faint accent glow top-right */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '80px', height: '80px', borderRadius: '50%',
        backgroundColor: borderColor, opacity: 0.04,
        transform: 'translate(30%, -30%)',
        pointerEvents: 'none',
      }} />

      {/* Big value */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '2.5rem',
        fontWeight: 'var(--font-weight-light)',
        color: 'var(--color-neutral-900)',
        lineHeight: 1,
        letterSpacing: '-0.03em',
      }}>
        {value}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-neutral-400)',
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: 1.3,
        display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        {label}
        {clickable && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke={hov ? borderColor : 'var(--color-neutral-400)'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'stroke var(--transition-fast)', flexShrink: 0 }}>
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2.  Modality Confidence row
───────────────────────────────────────────────────────────── */
function ModalityBar({ id, label, pct, color }) {
  return (
    <div id={`modality-${id}`} style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-neutral-700)',
          fontWeight: 'var(--font-weight-medium)',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-sm)',
          color,
          fontWeight: 'var(--font-weight-medium)',
        }}>
          {pct}%
        </span>
      </div>

      {/* Track */}
      <div style={{
        height: '7px',
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-neutral-100)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 'var(--radius-full)',
          backgroundColor: color,
          width: `${pct}%`,
          transition: 'width 700ms cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   3.  Risk badge pill
───────────────────────────────────────────────────────────── */
function RiskPill({ level }) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG.low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 9px',
      borderRadius: 'var(--radius-full)',
      border: `1px solid ${cfg.border}`,
      backgroundColor: cfg.bg,
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-semibold)',
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        backgroundColor: cfg.color, flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   4.  Recent Cases table
───────────────────────────────────────────────────────────── */
const TH_STYLE = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-neutral-400)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--letter-spacing-wider)',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--color-neutral-100)',
  backgroundColor: 'var(--color-bg)',
};

function CaseRow({ c, idx }) {
  const [hov, setHov] = useState(false);
  const navigate = useNavigate();
  const stCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.closed;

  return (
    <tr
      id={`case-row-${c.id}`}
      onClick={() => navigate(`/app/results/${c.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: hov ? 'var(--color-primary-subtle)' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color var(--transition-fast)',
        borderBottom: idx < 4 ? '1px solid var(--color-neutral-100)' : 'none',
      }}
    >
      {/* Case ID */}
      <td style={{ padding: '12px 14px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-neutral-800)',
          fontWeight: 'var(--font-weight-medium)',
        }}>
          {c.id}
        </span>
      </td>

      {/* Age */}
      <td style={{ padding: '12px 14px' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-700)' }}>
          {c.age}
        </span>
      </td>

      {/* Gender */}
      <td style={{ padding: '12px 14px' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)' }}>
          {c.sex}
        </span>
      </td>

      {/* Risk Level */}
      <td style={{ padding: '12px 14px' }}>
        <RiskPill level={c.riskLevel} />
      </td>

      {/* Fusion Score */}
      <td style={{ padding: '12px 14px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-sm)',
          color: RISK_CONFIG[c.riskLevel]?.color ?? 'var(--color-neutral-700)',
          fontWeight: 'var(--font-weight-medium)',
        }}>
          {c.riskScore.toFixed(2)}
        </span>
      </td>

      {/* Date */}
      <td style={{ padding: '12px 14px' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-500)' }}>
          {fmtDate(c.screeningDate)}
        </span>
      </td>

      {/* Status */}
      <td style={{ padding: '12px 14px' }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: stCfg.color,
          fontWeight: 'var(--font-weight-semibold)',
        }}>
          {stCfg.label}
        </span>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const RECENT = MOCK_CASES.slice(0, 5);

  return (
    <main id="dashboard-page" style={{
      display: 'flex', flexDirection: 'column', gap: '28px',
    }}>

      {/* ── 1. Page header ─────────────────────────────────── */}
      <header>
        <h1 style={{
          fontSize: '1.375rem',      /* ~22px */
          fontWeight: 'var(--font-weight-light)',
          color: 'var(--color-neutral-900)',
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          Overview
        </h1>
        <p style={{
          marginTop: '4px',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-neutral-400)',
          fontWeight: 'var(--font-weight-normal)',
        }}>
          Real-time snapshot of today's screening activity and AI confidence metrics.
        </p>
      </header>

      {/* ── 2. StatCard grid ───────────────────────────────── */}
      <section aria-label="Summary statistics">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px',
        }}>
          {STAT_CARDS.map((s) => (
            <StatCard key={s.id} {...s} />
          ))}
        </div>
      </section>

      {/* ── 3. Modality Confidence ─────────────────────────── */}
      <section
        id="modality-confidence-card"
        aria-label="Modality confidence"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xs)',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--color-neutral-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-neutral-800)',
              margin: 0, letterSpacing: '-0.01em',
            }}>
              Modality Confidence
            </h2>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-neutral-400)',
              marginTop: '2px',
            }}>
              Average model confidence per input channel — today
            </p>
          </div>
          {/* Legend dot */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-neutral-400)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Live
          </span>
        </div>

        {/* Bars */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {MODALITY_CONFIDENCE.map((m) => (
            <ModalityBar key={m.id} {...m} />
          ))}
        </div>
      </section>

      {/* ── 4. Recent Cases table ──────────────────────────── */}
      <section
        id="recent-cases-card"
        aria-label="Recent cases"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xs)',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--color-neutral-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-neutral-800)',
              margin: 0, letterSpacing: '-0.01em',
            }}>
              Recent Cases
            </h2>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-neutral-400)',
              marginTop: '2px',
            }}>
              Last 5 screened — click any row to open the XAI report
            </p>
          </div>
          <a
            href="/app/cases"
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-primary-dark)',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            View all
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>

        {/* Scrollable table wrapper */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 'var(--font-size-sm)',
          }}>
            <thead>
              <tr>
                {['Case ID', 'Age', 'Gender', 'Risk Level', 'Fusion Score', 'Date', 'Status'].map((h) => (
                  <th key={h} style={TH_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT.map((c, i) => (
                <CaseRow key={c.id} c={c} idx={i} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
