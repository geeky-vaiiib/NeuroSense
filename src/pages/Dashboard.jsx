/**
 * Dashboard.jsx
 * Overview page — stats, recent cases, activity summary.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import { MOCK_CASES, DASHBOARD_STATS } from '../data/mockData';

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 'var(--space-5)',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-900)',
  },
  viewAll: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    fontWeight: 'var(--font-weight-medium)',
  },
  caseTable: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 120px 140px 140px 100px',
    alignItems: 'center',
    padding: 'var(--space-4) var(--space-6)',
    borderBottom: '1px solid var(--color-neutral-100)',
    gap: 'var(--space-4)',
    transition: 'background-color var(--transition-fast)',
  },
  tableHeader: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-400)',
    letterSpacing: 'var(--letter-spacing-wider)',
    textTransform: 'uppercase',
    backgroundColor: 'var(--color-bg)',
  },
  caseId: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-500)',
  },
  patientName: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-neutral-800)',
  },
  statusChip: (status) => {
    const map = {
      reviewed: { color: 'var(--color-risk-low)', bg: 'var(--color-risk-low-muted)' },
      'pending-review': { color: 'var(--color-risk-moderate)', bg: 'var(--color-risk-moderate-muted)' },
      'in-progress': { color: 'var(--color-primary)', bg: 'var(--color-primary-muted)' },
      closed: { color: 'var(--color-neutral-500)', bg: 'var(--color-neutral-100)' },
    };
    const s = map[status] || map.closed;
    return {
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-semibold)',
      fontFamily: 'var(--font-mono)',
      color: s.color,
      backgroundColor: s.bg,
      whiteSpace: 'nowrap',
    };
  },
};

const ICONS = {
  total: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  high: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  pending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  completion: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
};

const STATUS_LABELS = {
  reviewed: 'Reviewed',
  'pending-review': 'Pending Review',
  'in-progress': 'In Progress',
  closed: 'Closed',
};

export default function Dashboard() {
  const recent = MOCK_CASES.slice(0, 5);

  return (
    <main id="dashboard-page" style={styles.page}>
      {/* Stats */}
      <section aria-label="Summary statistics">
        <div style={styles.statsGrid}>
          <StatCard
            id="stat-total-cases"
            label="Total Cases"
            value={DASHBOARD_STATS.totalCases}
            icon={ICONS.total}
            iconBg="var(--color-primary-subtle)"
            iconColor="var(--color-primary)"
            trend="up"
            trendValue="+8"
            trendLabel="this month"
          />
          <StatCard
            id="stat-high-risk"
            label="High Risk"
            value={DASHBOARD_STATS.highRisk}
            icon={ICONS.high}
            iconBg="var(--color-risk-high-muted)"
            iconColor="var(--color-risk-high)"
            trend="up"
            trendValue="+3"
            trendLabel="vs last month"
          />
          <StatCard
            id="stat-awaiting"
            label="Awaiting Review"
            value={DASHBOARD_STATS.awaitingReview}
            icon={ICONS.pending}
            iconBg="var(--color-risk-moderate-muted)"
            iconColor="var(--color-risk-moderate)"
            trend="down"
            trendValue="-2"
            trendLabel="vs last month"
          />
          <StatCard
            id="stat-completion"
            label="Completion Rate"
            value={`${Math.round(DASHBOARD_STATS.completionRate * 100)}%`}
            icon={ICONS.completion}
            iconBg="var(--color-risk-low-muted)"
            iconColor="var(--color-risk-low)"
            trend="up"
            trendValue="+2%"
            trendLabel="vs last month"
          />
        </div>
      </section>

      {/* Recent Cases */}
      <section style={styles.section} aria-label="Recent cases">
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Recent Cases</h2>
          <Link to="/cases" style={styles.viewAll}>View all →</Link>
        </div>

        <div style={styles.caseTable} role="table" aria-label="Recent patient cases">
          {/* Header */}
          <div style={{ ...styles.tableRow, ...styles.tableHeader }} role="row">
            <div role="columnheader">Patient</div>
            <div role="columnheader">Risk Level</div>
            <div role="columnheader">Clinician</div>
            <div role="columnheader">Screening</div>
            <div role="columnheader">Status</div>
          </div>

          {/* Rows */}
          {recent.map((c) => (
            <div key={c.id} style={styles.tableRow} role="row">
              <div role="cell">
                <div style={styles.patientName}>{c.patientName}</div>
                <div style={styles.caseId}>{c.id} · {c.age}yo</div>
              </div>
              <div role="cell">
                <RiskBadge level={c.riskLevel} size="sm" showScore score={c.riskScore} />
              </div>
              <div role="cell" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)' }}>
                {c.clinician}
              </div>
              <div role="cell" style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-500)' }}>
                {c.completedScreenings[0]}
              </div>
              <div role="cell">
                <span style={styles.statusChip(c.status)}>{STATUS_LABELS[c.status]}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
