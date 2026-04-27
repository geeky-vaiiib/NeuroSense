/**
 * Cases.jsx
 * Full patient case management with search, filter, and detail view.
 */

import React, { useState, useMemo } from 'react';
import RiskBadge from '../components/RiskBadge';
import Modal from '../components/Modal';
import { MOCK_CASES } from '../data/mockData';

const RISK_FILTERS = ['all', 'high', 'moderate', 'low'];
const STATUS_LABELS = {
  reviewed: 'Reviewed',
  'pending-review': 'Pending Review',
  'in-progress': 'In Progress',
  closed: 'Closed',
};

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    height: '38px',
    padding: '0 var(--space-4)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-bg-card)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-700)',
    fontFamily: 'var(--font-body)',
  },
  filterChip: (active) => ({
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--radius-full)',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
    backgroundColor: active ? 'var(--color-primary-muted)' : 'var(--color-bg-card)',
    color: active ? 'var(--color-primary-dark)' : 'var(--color-neutral-500)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: active ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    fontFamily: 'var(--font-body)',
    textTransform: 'capitalize',
  }),
  caseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 'var(--space-5)',
  },
  caseCard: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-5)',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-3)',
  },
  patientName: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-900)',
  },
  caseId: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
    marginTop: '2px',
  },
  diagnosis: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-600)',
    lineHeight: 'var(--line-height-snug)',
  },
  cardMeta: {
    display: 'flex',
    gap: 'var(--space-4)',
    borderTop: '1px solid var(--color-neutral-100)',
    paddingTop: 'var(--space-3)',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
  },
  metaLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--letter-spacing-wide)',
  },
  metaValue: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-700)',
    fontFamily: 'var(--font-mono)',
  },
  tagRow: {
    display: 'flex',
    gap: 'var(--space-2)',
    flexWrap: 'wrap',
  },
  tag: {
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-xs)',
    backgroundColor: 'var(--color-neutral-100)',
    color: 'var(--color-neutral-500)',
    fontFamily: 'var(--font-mono)',
  },
  emptyState: {
    textAlign: 'center',
    padding: 'var(--space-16)',
    color: 'var(--color-neutral-400)',
    gridColumn: '1 / -1',
  },
};

export default function Cases() {
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const filtered = useMemo(() => {
    return MOCK_CASES.filter((c) => {
      const matchQuery =
        !query ||
        c.patientName.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase().includes(query.toLowerCase()) ||
        c.diagnosis.toLowerCase().includes(query.toLowerCase());
      const matchRisk = riskFilter === 'all' || c.riskLevel === riskFilter;
      return matchQuery && matchRisk;
    });
  }, [query, riskFilter]);

  return (
    <main id="cases-page" style={styles.page}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          id="cases-search"
          type="search"
          placeholder="Search by name, ID, or diagnosis…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.searchInput}
          aria-label="Search cases"
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="group" aria-label="Filter by risk level">
          {RISK_FILTERS.map((r) => (
            <button
              key={r}
              id={`filter-risk-${r}`}
              style={styles.filterChip(riskFilter === r)}
              onClick={() => setRiskFilter(r)}
              aria-pressed={riskFilter === r}
            >
              {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)' }}>
          {filtered.length} cases
        </span>
      </div>

      {/* Case Grid */}
      <div style={styles.caseGrid}>
        {filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>No cases found</p>
            <p style={{ fontSize: 'var(--font-size-sm)' }}>Try adjusting your search or filter.</p>
          </div>
        ) : (
          filtered.map((c) => (
            <article
              key={c.id}
              id={`case-card-${c.id}`}
              style={{
                ...styles.caseCard,
                boxShadow: hoveredId === c.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                transform: hoveredId === c.id ? 'translateY(-3px)' : 'none',
                borderColor: hoveredId === c.id ? 'var(--color-neutral-300)' : 'var(--color-neutral-200)',
              }}
              onClick={() => setSelectedCase(c)}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              role="button"
              tabIndex={0}
              aria-label={`View case ${c.id} for ${c.patientName}`}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedCase(c)}
            >
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.patientName}>{c.patientName}</div>
                  <div style={styles.caseId}>{c.id} · {c.age}yo</div>
                </div>
                <RiskBadge level={c.riskLevel} size="sm" showScore score={c.riskScore} />
              </div>

              <div style={styles.diagnosis}>{c.diagnosis}</div>

              <div style={styles.tagRow}>
                {c.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>{tag}</span>
                ))}
              </div>

              <div style={styles.cardMeta}>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Clinician</span>
                  <span style={styles.metaValue}>{c.clinician.replace('Dr. ', '')}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Date</span>
                  <span style={styles.metaValue}>{c.screeningDate}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Status</span>
                  <span style={styles.metaValue}>{STATUS_LABELS[c.status]}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Case Detail Modal */}
      <Modal
        open={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        title={selectedCase ? `${selectedCase.patientName} — ${selectedCase.id}` : ''}
        subtitle={selectedCase?.diagnosis}
        size="lg"
        footer={
          <button
            id="close-case-modal-btn"
            onClick={() => setSelectedCase(null)}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-neutral-200)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-neutral-700)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Close
          </button>
        }
      >
        {selectedCase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <RiskBadge level={selectedCase.riskLevel} size="lg" showScore score={selectedCase.riskScore} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-500)' }}>
                {STATUS_LABELS[selectedCase.status]}
              </span>
            </div>

            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              {[
                ['Age / Sex', `${selectedCase.age} · ${selectedCase.sex}`],
                ['Clinician', selectedCase.clinician],
                ['Referral Date', selectedCase.referralDate],
                ['Screening Date', selectedCase.screeningDate],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', padding: 'var(--space-4)', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-lg)' }}>
                  <dt style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)', textTransform: 'uppercase', letterSpacing: 'var(--letter-spacing-wide)' }}>{l}</dt>
                  <dd style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-800)', fontWeight: 'var(--font-weight-medium)' }}>{v}</dd>
                </div>
              ))}
            </dl>

            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-neutral-700)', marginBottom: 'var(--space-3)' }}>Completed Screenings</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {selectedCase.completedScreenings.map((s) => (
                  <span key={s} style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary-dark)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-semibold)' }}>{s}</span>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-neutral-700)', marginBottom: 'var(--space-2)' }}>Clinical Notes</div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)', lineHeight: 'var(--line-height-relaxed)', backgroundColor: 'var(--color-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', borderLeft: '3px solid var(--color-primary)' }}>
                {selectedCase.notes}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
