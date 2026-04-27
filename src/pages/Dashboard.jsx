/**
 * Dashboard.jsx — Redesigned with rich cards, activity feed, risk distribution, quick actions.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import RiskBadge from '../components/RiskBadge';
import { MOCK_CASES, DASHBOARD_STATS } from '../data/mockData';

/* ── helpers ─────────────────────────────────────────────── */
const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const TODAY = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const STATUS_META = {
  reviewed:       { label: 'Reviewed',       color: 'var(--color-risk-low)',      bg: 'var(--color-risk-low-muted)' },
  'pending-review':{ label: 'Pending',        color: 'var(--color-risk-moderate)', bg: 'var(--color-risk-moderate-muted)' },
  'in-progress':  { label: 'In Progress',     color: 'var(--color-primary)',       bg: 'var(--color-primary-muted)' },
  closed:         { label: 'Closed',          color: 'var(--color-neutral-400)',   bg: 'var(--color-neutral-100)' },
};

const ACTIVITY = [
  { time: '09:41', actor: 'Dr. Mehta',  action: 'completed RAADS-R for',   subject: 'Morgan L.',  type: 'screen' },
  { time: '09:18', actor: 'System',     action: 'flagged high-risk case',   subject: 'NS-2024-005',type: 'flag' },
  { time: '08:55', actor: 'Dr. Torres', action: 'reviewed results for',     subject: 'Sam T.',     type: 'review' },
  { time: '08:30', actor: 'Dr. Okafor', action: 'closed case',              subject: 'NS-2024-004',type: 'close' },
  { time: 'Yesterday', actor: 'Dr. Mehta', action: 'added notes to',        subject: 'Jordan A.', type: 'note' },
];

const ACTIVITY_ICONS = {
  screen: { color: 'rgba(124,154,133,0.15)', stroke: '#7C9A85',
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/></svg> },
  flag:   { color: 'rgba(192,85,90,0.12)',   stroke: '#C0555A',
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> },
  review: { color: 'rgba(94,122,103,0.12)',  stroke: '#5E7A67',
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  close:  { color: 'rgba(138,129,120,0.12)', stroke: '#8A8178',
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
  note:   { color: 'rgba(184,135,58,0.10)',  stroke: '#B8873A',
    svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
};

const RISK_DIST = [
  { label: 'High',     count: 31, color: 'var(--color-risk-high)',     pct: 22 },
  { label: 'Moderate', count: 58, color: 'var(--color-risk-moderate)', pct: 41 },
  { label: 'Low',      count: 53, color: 'var(--color-risk-low)',      pct: 37 },
];

/* ── StatCard ─────────────────────────────────────────────── */
function Stat({ id, label, value, sub, icon, iconColor, iconBg, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      id={id}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 250ms cubic-bezier(.4,0,.2,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent top border */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: accent || 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
        borderRadius: '16px 16px 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-neutral-500)', letterSpacing: '0.01em' }}>{label}</span>
        <span style={{
          width: '36px', height: '36px', borderRadius: '10px',
          backgroundColor: iconBg || 'var(--color-primary-subtle)',
          color: iconColor || 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</span>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--color-neutral-900)', lineHeight: 1 }}>
        {value}
      </div>

      {sub && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const recent = MOCK_CASES.slice(0, 5);
  const [hovRow, setHovRow] = useState(null);

  return (
    <main id="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Welcome strip ───────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
        borderRadius: '16px',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: '0 4px 24px rgba(94,122,103,0.25)',
      }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.65)', marginBottom: '4px', fontWeight: 500 }}>{TODAY}</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.025em' }}>
            {GREETING()}, {user?.name?.split(' ')[0] ?? 'Doctor'}

          </h1>
          <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
            {DASHBOARD_STATS.awaitingReview} cases awaiting your review today
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'New Screening', to: '/app/screening', primary: true },
            { label: 'View Cases',    to: '/app/cases',     primary: false },
          ].map(({ label, to, primary }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: primary ? 'none' : '1.5px solid rgba(255,255,255,0.4)',
                backgroundColor: primary ? '#fff' : 'transparent',
                color: primary ? 'var(--color-primary-dark)' : '#fff',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                transition: 'all 150ms',
              }}
            >{label}</button>
          ))}
        </div>
      </section>

      {/* ── Stat cards ──────────────────────────────────── */}
      <section aria-label="Summary statistics" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
      }}>
        <Stat
          id="stat-total-cases" label="Total Cases" value={142}
          sub="+8 this month"
          accent="linear-gradient(90deg, #7C9A85, #9DB5A4)"
          iconBg="rgba(124,154,133,0.12)" iconColor="#5E7A67"
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <Stat
          id="stat-high-risk" label="High Risk" value={31}
          sub="+3 vs last month"
          accent="linear-gradient(90deg, #C0555A, #E8898D)"
          iconBg="rgba(192,85,90,0.1)" iconColor="#C0555A"
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <Stat
          id="stat-awaiting" label="Awaiting Review" value={9}
          sub="−2 vs last week"
          accent="linear-gradient(90deg, #B8873A, #D4AA72)"
          iconBg="rgba(184,135,58,0.1)" iconColor="#B8873A"
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <Stat
          id="stat-completion" label="Completion Rate" value="94%"
          sub="+2% vs last month"
          accent="linear-gradient(90deg, #5E7A67, #7C9A85)"
          iconBg="rgba(94,122,103,0.12)" iconColor="#5E7A67"
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
        />
        <Stat
          id="stat-avg-time" label="Avg. Screen Time" value="22m"
          sub="Across 7 tools"
          accent="linear-gradient(90deg, #8A8178, #A89E94)"
          iconBg="rgba(138,129,120,0.1)" iconColor="#6B6560"
          icon={<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </section>

      {/* ── Two-column lower section ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

        {/* LEFT — Recent cases table */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-neutral-900)', margin: 0 }}>Recent Cases</h2>
            <Link to="/app/cases" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>View all →</Link>
          </div>

          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-neutral-200)',
            borderRadius: '14px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-xs)',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 130px 90px 90px',
              padding: '11px 20px', gap: '12px',
              backgroundColor: 'var(--color-bg)',
              borderBottom: '1px solid var(--color-neutral-200)',
            }}>
              {['Patient', 'Risk', 'Clinician', 'Tool', 'Status'].map((h) => (
                <span key={h} style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-neutral-400)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {recent.map((c, i) => {
              const sm = STATUS_META[c.status] || STATUS_META.closed;
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/app/results/${c.id}`)}
                  onMouseEnter={() => setHovRow(c.id)}
                  onMouseLeave={() => setHovRow(null)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 130px 90px 90px',
                    padding: '13px 20px', gap: '12px', alignItems: 'center',
                    borderBottom: i < recent.length - 1 ? '1px solid var(--color-neutral-100)' : 'none',
                    cursor: 'pointer',
                    backgroundColor: hovRow === c.id ? 'var(--color-bg)' : 'transparent',
                    transition: 'background-color 150ms',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-neutral-800)' }}>{c.patientName}</div>
                    <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-400)', marginTop: '1px' }}>{c.id} · {c.age}yo</div>
                  </div>
                  <RiskBadge level={c.riskLevel} size="sm" showScore score={c.riskScore} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-600)' }}>{c.clinician.replace('Dr. ', 'Dr.')}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-500)' }}>{c.completedScreenings[0]}</span>
                  <span style={{
                    display: 'inline-block', padding: '3px 9px',
                    borderRadius: '999px', fontSize: '0.6875rem', fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    color: sm.color, backgroundColor: sm.bg,
                    whiteSpace: 'nowrap',
                  }}>{sm.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT — Risk distribution + Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Risk distribution */}
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-neutral-200)',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)', margin: '0 0 16px' }}>Risk Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {RISK_DIST.map((r) => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>{r.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-neutral-700)', fontWeight: 600 }}>{r.count}</span>
                  </div>
                  <div style={{ height: '7px', borderRadius: '999px', backgroundColor: 'var(--color-neutral-100)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${r.pct}%`, borderRadius: '999px',
                      backgroundColor: r.color,
                      transition: 'width 800ms cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-neutral-100)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-neutral-400)' }}>
              142 total · last 30 days
            </div>
          </div>

          {/* Activity feed */}
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-neutral-200)',
            borderRadius: '14px',
            padding: '20px',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-neutral-800)', margin: '0 0 14px' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {ACTIVITY.map((a, i) => {
                const meta = ACTIVITY_ICONS[a.type];
                return (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    paddingBottom: i < ACTIVITY.length - 1 ? '12px' : '0',
                    marginBottom: i < ACTIVITY.length - 1 ? '12px' : '0',
                    borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--color-neutral-100)' : 'none',
                  }}>
                    <span style={{
                      width: '28px', height: '28px',
                      borderRadius: '8px', backgroundColor: meta.color,
                      color: meta.stroke,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{meta.svg}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-neutral-700)', lineHeight: 1.4 }}>
                        <strong style={{ fontWeight: 600, color: 'var(--color-neutral-800)' }}>{a.actor}</strong>{' '}
                        {a.action}{' '}
                        <strong style={{ fontWeight: 500, color: 'var(--color-primary-dark)' }}>{a.subject}</strong>
                      </p>
                      <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-400)', marginTop: '2px', display: 'block' }}>{a.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
