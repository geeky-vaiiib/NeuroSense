import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import { casesApi } from '../services/api';

const FILTERS = ['all', 'adult', 'child', 'toddler'];

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: '22px',
    padding: '24px',
    boxShadow: 'var(--shadow-xs)',
  },
};

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: '36px',
        padding: '0 14px',
        borderRadius: '999px',
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
        backgroundColor: active ? 'var(--color-primary-muted)' : 'var(--clr-surface)',
        color: active ? 'var(--color-primary-dark)' : 'var(--color-neutral-600)',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-regular)',
        letterSpacing: 'var(--tracking-normal)',
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <div
      style={{
        borderRadius: '18px',
        border: '1px solid var(--color-neutral-200)',
        padding: '18px',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--weight-light)', letterSpacing: 'var(--tracking-tight)', lineHeight: 1, fontFamily: 'var(--font-display)', color: 'var(--color-neutral-900)' }}>
        {value}
      </div>
      <div style={{ marginTop: '6px', fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-neutral-400)' }}>
        {label}
      </div>
      <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--color-neutral-400)', lineHeight: 'var(--leading-relaxed)' }}>
        {helper}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      setLoading(true);
      setError('');
      try {
        const data = await casesApi.dashboard(
          categoryFilter === 'all' ? {} : { category: categoryFilter }
        );
        if (active) {
          setSummary(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      active = false;
    };
  }, [categoryFilter]);

  const totals = summary?.totals ?? {
    totalCases: 0,
    adultCases: 0,
    childCases: 0,
    highRisk: 0,
    awaitingReview: 0,
    mockCases: 0,
    averageRiskScore: 0,
    averageAq10Score: 0,
  };

  const statCards = [
    {
      label:
        categoryFilter === 'adult' ? 'Adult cases' :
        categoryFilter === 'child' ? 'Child cases' :
        categoryFilter === 'toddler' ? 'Toddler cases' :
        'All cases',
      value: totals.totalCases,
      helper: 'Current dashboard scope',
    },
    {
      label: 'High risk',
      value: totals.highRisk,
      helper: 'Cases flagged for elevated attention',
    },
    {
      label: 'Awaiting review',
      value: totals.awaitingReview,
      helper: 'Pending clinician follow-up',
    },
    {
      label: 'Avg AQ-10',
      value: totals.averageAq10Score,
      helper: 'Average questionnaire score',
    },
  ];

  return (
    <main id="dashboard-page" style={styles.page}>
      <section style={styles.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginBottom: '18px',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-tight)', lineHeight: 'var(--leading-tight)', color: 'var(--color-neutral-900)', fontFamily: 'var(--font-display)' }}>Overview</h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-regular)', lineHeight: 'var(--leading-relaxed)', color: 'var(--color-neutral-500)' }}>
              Track adult, child, and toddler screening activity with category-aware counts, explainability readiness, and recent cases.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                label={filter === 'all' ? 'All' : filter[0].toUpperCase() + filter.slice(1)}
                active={categoryFilter === filter}
                onClick={() => setCategoryFilter(filter)}
              />
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>Loading dashboard…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        )}
      </section>

      {error && (
        <section
          style={{
            ...styles.card,
            borderColor: 'var(--color-risk-high-border)',
            backgroundColor: 'var(--color-risk-high-muted)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--color-risk-high)', fontWeight: 600 }}>
            {error}
          </p>
        </section>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '20px',
        }}
      >
        <div style={styles.card}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-neutral-800)' }}>
              Category mix
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-400)', lineHeight: 'var(--leading-relaxed)' }}>
              Category counts remain visible even while filtering the dashboard.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {(summary?.categoryBreakdown ?? []).map((item) => (
              <div
                key={item.category}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: '16px',
                  border: '1px solid var(--color-neutral-200)',
                  backgroundColor: 'var(--color-bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CategoryBadge category={item.category} size="md" />
                  <span style={{ color: 'var(--color-neutral-700)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                    {item.label}
                  </span>
                </div>
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-neutral-900)' }}>
                  {item.count}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-neutral-800)' }}>
              Pipeline confidence
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-400)', lineHeight: 'var(--leading-relaxed)' }}>
              Confidence indicators adapt to the active dashboard category.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '14px' }}>
            {(summary?.modalityConfidence ?? []).map((item) => (
              <div key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--color-neutral-700)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>
                    {item.label}
                  </span>
                  <span style={{ color: 'var(--color-primary-dark)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)' }}>
                    {item.pct}%
                  </span>
                </div>
                <div
                  style={{
                    height: '10px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-neutral-100)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${item.pct}%`,
                      height: '100%',
                      borderRadius: '999px',
                      backgroundColor: 'var(--color-primary)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '18px',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-tight)', color: 'var(--color-neutral-800)' }}>
              Recent cases
            </h2>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-neutral-400)', lineHeight: 'var(--leading-relaxed)' }}>
              Each row retains its category tag for quick routing and review.
            </p>
          </div>
          <Link
            to="/app/cases"
            style={{
              color: 'var(--color-primary-dark)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            View all cases
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Case', 'Category', 'Age', 'Risk', 'Date', 'Status'].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      color: 'var(--color-neutral-400)',
                      fontSize: 'var(--text-2xs)',
                      fontWeight: 'var(--weight-semibold)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--tracking-widest)',
                      borderBottom: '1px solid var(--color-neutral-100)',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(summary?.recentCases ?? []).map((record) => (
                <tr
                  key={record.id}
                  onClick={() => navigate(`/app/results/${record.id}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-neutral-100)' }}
                >
                  <td style={{ padding: '14px 12px' }}>
                    <strong style={{ color: 'var(--color-neutral-900)' }}>
                      {record.subjectName || 'Unnamed case'}
                    </strong>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', letterSpacing: 'var(--tracking-wide)', color: 'var(--color-neutral-500)', marginTop: '4px' }}>
                      {record.id}
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <CategoryBadge category={record.category} size="sm" />
                  </td>
                  <td style={{ padding: '14px 12px', color: 'var(--color-neutral-700)' }}>{record.age}</td>
                  <td style={{ padding: '14px 12px' }}>
                    <RiskBadge level={record.riskLevel} size="sm" showScore score={record.riskScore} />
                  </td>
                  <td style={{ padding: '14px 12px', color: 'var(--color-neutral-600)' }}>
                    {record.screeningDate}
                  </td>
                  <td style={{ padding: '14px 12px', color: 'var(--color-neutral-600)' }}>
                    {record.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
