/**
 * Cases.jsx — Redesigned: patient avatar, horizontal card layout,
 * action buttons per card, last activity timestamp, filter toolbar.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RiskBadge from '../components/RiskBadge';
import Modal from '../components/Modal';
import { MOCK_CASES } from '../data/mockData';

const RISK_FILTERS = ['all', 'high', 'moderate', 'low'];
const STATUS_META = {
  reviewed:        { label: 'Reviewed',       color: 'var(--color-risk-low)',      bg: 'var(--color-risk-low-muted)' },
  'pending-review':{ label: 'Pending Review', color: 'var(--color-risk-moderate)', bg: 'var(--color-risk-moderate-muted)' },
  'in-progress':   { label: 'In Progress',    color: 'var(--color-primary)',       bg: 'var(--color-primary-muted)' },
  closed:          { label: 'Closed',         color: 'var(--color-neutral-400)',   bg: 'var(--color-neutral-100)' },
};

const LAST_ACTIVITY = {
  'NS-2024-001': '2h ago',
  'NS-2024-002': '5h ago',
  'NS-2024-003': 'Yesterday',
  'NS-2024-004': '3 days ago',
  'NS-2024-005': '30m ago',
};

/* Deterministic avatar colour from initials */
const AVATAR_COLORS = [
  ['#7C9A85', '#5E7A67'], ['#8A8178', '#6B6560'],
  ['#B8873A', '#8A6028'], ['#C0555A', '#9A3A3F'], ['#5E7A67', '#3D5C46'],
];
function avatarColor(id) {
  const idx = parseInt(id.replace(/\D/g, '').slice(-1)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ── Compact tag ─────────────────────────────────────────── */
function Tag({ label }) {
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.6875rem',
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      color: 'var(--color-neutral-500)',
      backgroundColor: 'var(--color-neutral-100)',
      border: '1px solid var(--color-neutral-200)',
    }}>{label}</span>
  );
}

/* ── Case card ───────────────────────────────────────────── */
function CaseCard({ c, onView, onFlag }) {
  const [hov, setHov] = useState(false);
  const sm = STATUS_META[c.status] || STATUS_META.closed;
  const [grad1, grad2] = avatarColor(c.id);

  return (
    <article
      id={`case-card-${c.id}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: `1px solid ${hov ? 'var(--color-neutral-300)' : 'var(--color-neutral-200)'}`,
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 250ms cubic-bezier(.4,0,.2,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Risk-level colour strip at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        backgroundColor:
          c.riskLevel === 'high'     ? 'var(--color-risk-high)'     :
          c.riskLevel === 'moderate' ? 'var(--color-risk-moderate)' : 'var(--color-risk-low)',
        opacity: 0.7,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Avatar */}
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
          background: `linear-gradient(135deg, ${grad1}, ${grad2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.875rem', fontWeight: 700, color: '#fff',
        }}>
          {initials(c.patientName)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-neutral-900)' }}>
            {c.patientName}
          </div>
          <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-400)', marginTop: '2px' }}>
            {c.id} · {c.age}yo · {c.sex}
          </div>
        </div>

        <RiskBadge level={c.riskLevel} size="sm" showScore score={c.riskScore} />
      </div>

      {/* Diagnosis */}
      <div style={{
        fontSize: '0.8125rem', color: 'var(--color-neutral-600)',
        lineHeight: 1.45, fontStyle: 'italic',
        paddingLeft: '2px',
      }}>
        {c.diagnosis}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {c.tags.slice(0, 3).map((t) => <Tag key={t} label={t} />)}
        {c.tags.length > 3 && (
          <Tag label={`+${c.tags.length - 3}`} />
        )}
      </div>

      {/* Meta strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderTop: '1px solid var(--color-neutral-100)',
        paddingTop: '12px', gap: '8px',
      }}>
        {[
          { label: 'Clinician', value: c.clinician.replace('Dr. ', 'Dr. ') },
          { label: 'Last Activity', value: LAST_ACTIVITY[c.id] ?? '—' },
          { label: 'Status', value: null, custom: (
            <span style={{
              padding: '2px 8px', borderRadius: '999px',
              fontSize: '0.6875rem', fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: sm.color, backgroundColor: sm.bg,
            }}>{sm.label}</span>
          )},
        ].map(({ label, value, custom }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
            {custom ?? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          id={`case-view-${c.id}`}
          onClick={() => onView(c)}
          style={{
            flex: 1, height: '34px', borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
            color: '#fff', fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'opacity 150ms',
          }}
        >
          View Details
        </button>
        <button
          id={`case-results-${c.id}`}
          onClick={() => onFlag(c.id)}
          style={{
            width: '34px', height: '34px', borderRadius: '10px',
            border: '1px solid var(--color-neutral-200)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-neutral-500)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 150ms',
            flexShrink: 0,
          }}
          title="View XAI Results"
          aria-label="View XAI Results"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </button>
        <button
          id={`case-flag-${c.id}`}
          style={{
            width: '34px', height: '34px', borderRadius: '10px',
            border: '1px solid var(--color-risk-high-border)',
            backgroundColor: 'var(--color-risk-high-muted)',
            color: 'var(--color-risk-high)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 150ms',
            flexShrink: 0,
          }}
          title="Flag for urgent review"
          aria-label="Flag case"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>
      </div>
    </article>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function Cases() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);
  const [hovSearch, setHovSearch] = useState(false);

  const filtered = useMemo(() => {
    return MOCK_CASES.filter((c) => {
      const q = query.toLowerCase();
      const matchQ = !q ||
        c.patientName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.clinician.toLowerCase().includes(q);
      const matchR = riskFilter === 'all' || c.riskLevel === riskFilter;
      return matchQ && matchR;
    });
  }, [query, riskFilter]);

  const handleViewResults = (caseId) => navigate(`/app/results/${caseId}`);

  return (
    <main id="cases-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <span style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: hovSearch ? 'var(--color-primary)' : 'var(--color-neutral-400)',
            pointerEvents: 'none', display: 'flex', alignItems: 'center',
            transition: 'color 150ms',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            id="cases-search"
            type="search"
            placeholder="Search by name, ID, diagnosis, clinician…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setHovSearch(true)}
            onBlur={() => setHovSearch(false)}
            style={{
              width: '100%', height: '40px',
              paddingLeft: '38px', paddingRight: '14px',
              border: `1.5px solid ${hovSearch ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
              borderRadius: '10px',
              backgroundColor: 'var(--color-bg-card)',
              fontSize: '0.875rem', color: 'var(--color-neutral-700)',
              fontFamily: 'var(--font-body)', outline: 'none',
              boxShadow: hovSearch ? '0 0 0 3px rgba(124,154,133,0.1)' : 'none',
              transition: 'all 150ms',
            }}
            aria-label="Search cases"
          />
        </div>

        {/* Risk filter chips */}
        <div style={{ display: 'flex', gap: '6px' }} role="group" aria-label="Filter by risk">
          {RISK_FILTERS.map((r) => {
            const active = riskFilter === r;
            return (
              <button
                key={r}
                id={`filter-risk-${r}`}
                onClick={() => setRiskFilter(r)}
                aria-pressed={active}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
                  backgroundColor: active ? 'var(--color-primary-muted)' : 'var(--color-bg-card)',
                  color: active ? 'var(--color-primary-dark)' : 'var(--color-neutral-500)',
                  fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 150ms', textTransform: 'capitalize',
                }}
              >
                {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            );
          })}
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-neutral-400)', whiteSpace: 'nowrap' }}>
          {filtered.length} case{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: '16px',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
          <p style={{ fontWeight: 600, color: 'var(--color-neutral-700)', marginBottom: '6px' }}>No cases found</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-400)' }}>Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '16px',
        }}>
          {filtered.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              onView={setSelectedCase}
              onFlag={handleViewResults}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        title={selectedCase ? `${selectedCase.patientName}` : ''}
        subtitle={selectedCase ? `${selectedCase.id} · ${selectedCase.diagnosis}` : ''}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              id="modal-view-xai"
              onClick={() => { navigate(`/app/results/${selectedCase.id}`); setSelectedCase(null); }}
              style={{
                padding: '9px 20px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                color: '#fff', fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >View XAI Results →</button>
            <button
              id="close-case-modal-btn"
              onClick={() => setSelectedCase(null)}
              style={{
                padding: '9px 20px', borderRadius: '10px',
                border: '1px solid var(--color-neutral-200)',
                backgroundColor: 'var(--color-bg)', color: 'var(--color-neutral-700)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem',
              }}
            >Close</button>
          </div>
        }
      >
        {selectedCase && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Patient header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: `linear-gradient(135deg, ${avatarColor(selectedCase.id)[0]}, ${avatarColor(selectedCase.id)[1]})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.125rem', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{initials(selectedCase.patientName)}</div>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-neutral-900)' }}>{selectedCase.patientName}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)', marginTop: '2px' }}>{selectedCase.age}yo · {selectedCase.sex}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <RiskBadge level={selectedCase.riskLevel} size="lg" showScore score={selectedCase.riskScore} />
              </div>
            </div>

            {/* Detail grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                ['Clinician', selectedCase.clinician],
                ['Referral Date', selectedCase.referralDate],
                ['Screening Date', selectedCase.screeningDate],
                ['Status', STATUS_META[selectedCase.status]?.label ?? selectedCase.status],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: '14px', backgroundColor: 'var(--color-bg)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '5px' }}>{l}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-neutral-800)' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Screenings */}
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-neutral-700)', marginBottom: '8px' }}>Completed Screenings</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {selectedCase.completedScreenings.map((s) => (
                  <span key={s} style={{
                    padding: '4px 12px', borderRadius: '999px',
                    backgroundColor: 'var(--color-primary-muted)',
                    color: 'var(--color-primary-dark)',
                    fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600,
                  }}>{s}</span>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-neutral-700)', marginBottom: '8px' }}>Clinical Notes</div>
              <p style={{
                fontSize: '0.875rem', color: 'var(--color-neutral-600)',
                lineHeight: 1.65, padding: '14px',
                backgroundColor: 'var(--color-bg)', borderRadius: '10px',
                borderLeft: '3px solid var(--color-primary)',
                margin: 0,
              }}>{selectedCase.notes}</p>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
