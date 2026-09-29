import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import { casesApi } from '../services/api';

const FILTERS = ['all', 'adult', 'child', 'toddler'];

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        minHeight: '32px',
        padding: '0 var(--sp-4)',
        borderRadius: 'var(--r-pill)',
        border: `1px solid ${active ? 'var(--ns-instrument)' : 'var(--ns-n200)'}`,
        backgroundColor: active ? 'var(--ns-instrument-dim)' : 'transparent',
        color: active ? 'var(--ns-instrument)' : 'var(--ns-n600)',
        fontSize: 'var(--ts-small)',
        fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
        cursor: 'pointer',
        transition: 'all var(--ease-fast)',
      }}
      onMouseOver={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--ns-n100)';
          e.currentTarget.style.color = 'var(--ns-n900)';
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--ns-n600)';
        }
      }}
    >
      {label}
    </button>
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
      id: 'stat-total',
      label:
        categoryFilter === 'all'
          ? 'Total cases'
          : `${categoryFilter[0].toUpperCase() + categoryFilter.slice(1)} cases`,
      value: totals.totalCases,
      trendLabel: 'Current dashboard scope',
      trendValue: null,
    },
    {
      id: 'stat-high',
      label: 'High risk',
      value: totals.highRisk,
      trendLabel: 'Cases flagged for attention',
      trend: 'up',
      trendValue: totals.highRisk > 0 ? '+1' : null,
    },
    {
      id: 'stat-review',
      label: 'Awaiting review',
      value: totals.awaitingReview,
      trendLabel: 'Pending clinician follow-up',
      trend: 'neutral',
      trendValue: null,
    },
    {
      id: 'stat-avg',
      label: 'Avg AQ-10',
      value: totals.averageAq10Score,
      trendLabel: 'Average questionnaire score',
      trend: 'neutral',
      trendValue: null,
    },
  ];

  return (
    <main id="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* ── Overview Panel ── */}
      <section className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--sp-4)',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            marginBottom: 'var(--sp-5)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--ts-h2)', marginBottom: 'var(--sp-1)', color: 'var(--ns-n900)' }}>Overview</h2>
            <p style={{ margin: 0, color: 'var(--ns-n600)', maxWidth: '60ch' }}>
              Track mixed adult and child screening activity with category-aware counts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
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
          <p style={{ margin: 0, color: 'var(--ns-n500)' }}>Loading dashboard…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
            {statCards.map((card) => (
              <StatCard key={card.id} {...card} />
            ))}
          </div>
        )}
      </section>

      {error && (
        <section
          className="panel"
          style={{
            borderColor: 'var(--ns-risk-high-border)',
            backgroundColor: 'var(--ns-risk-high-bg)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--ns-risk-high)', fontWeight: 'var(--fw-semibold)' }}>
            {error}
          </p>
        </section>
      )}

      {/* ── Two-column grid ── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 'var(--sp-5)',
        }}
      >
        <div className="panel">
          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <h2 style={{ fontSize: 'var(--ts-h3)', marginBottom: 'var(--sp-1)', color: 'var(--ns-n900)' }}>
              Category mix
            </h2>
            <p style={{ margin: 0, color: 'var(--ns-n500)', fontSize: 'var(--ts-small)' }}>
              Adult and child counts remain visible across filtering.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {(summary?.categoryBreakdown ?? []).map((item) => (
              <div
                key={item.category}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--sp-3)',
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderRadius: 'var(--r-md)',
                  border: 'var(--border)',
                  backgroundColor: 'var(--ns-surface-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <CategoryBadge category={item.category} size="md" />
                </div>
                <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--ns-n900)', fontSize: 'var(--ts-body)' }}>
                  {item.count}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div style={{ marginBottom: 'var(--sp-5)' }}>
            <h2 style={{ fontSize: 'var(--ts-h3)', marginBottom: 'var(--sp-1)', color: 'var(--ns-n900)' }}>
              Pipeline confidence
            </h2>
            <p style={{ margin: 0, color: 'var(--ns-n500)', fontSize: 'var(--ts-small)' }}>
              Average fusion confidence across the active scope.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {(summary?.modalityConfidence ?? []).map((item) => (
              <div key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                  <span style={{ color: 'var(--ns-n700)', fontSize: 'var(--ts-small)', fontWeight: 'var(--fw-medium)' }}>
                    {item.label}
                  </span>
                  <span style={{ color: 'var(--ns-n900)', fontFamily: 'var(--font-data)', fontSize: 'var(--ts-small)' }}>
                    {item.pct}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: 'var(--r-pill)',
                    backgroundColor: 'var(--ns-n150)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${item.pct}%`,
                      height: '100%',
                      borderRadius: 'var(--r-pill)',
                      backgroundColor: 'var(--ns-instrument)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent Cases ── */}
      <section className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--sp-4)',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 'var(--sp-5)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--ts-h3)', marginBottom: 'var(--sp-1)', color: 'var(--ns-n900)' }}>
              Recent cases
            </h2>
            <p style={{ margin: 0, color: 'var(--ns-n500)', fontSize: 'var(--ts-small)' }}>
              Latest completed screenings in this scope.
            </p>
          </div>
          <Link to="/app/cases" className="btn btn-ghost btn-sm">
            View all cases
          </Link>
        </div>

        <div style={{ overflowX: 'auto', margin: '0 calc(-1 * var(--panel-pad))' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: 'var(--border)' }}>
                {['Case', 'Category', 'Age', 'Risk', 'Date', 'Status'].map((header, i) => (
                  <th
                    key={header}
                    style={{
                      padding: `var(--sp-2) var(--sp-4)`,
                      paddingLeft: i === 0 ? 'var(--panel-pad)' : 'var(--sp-4)',
                      paddingRight: i === 5 ? 'var(--panel-pad)' : 'var(--sp-4)',
                      color: 'var(--ns-n500)',
                      fontSize: 'var(--ts-caption)',
                      fontWeight: 'var(--fw-semibold)',
                      letterSpacing: 'var(--ls-label)',
                      textTransform: 'uppercase',
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
                  style={{ cursor: 'pointer', borderBottom: 'var(--border)', transition: 'background-color var(--ease-fast)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--ns-surface-2)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)', paddingLeft: 'var(--panel-pad)' }}>
                    <div style={{ fontWeight: 'var(--fw-medium)', color: 'var(--ns-n900)' }}>
                      {record.subjectName || 'Unnamed case'}
                    </div>
                    <div style={{ color: 'var(--ns-n500)', fontSize: 'var(--ts-caption)', fontFamily: 'var(--font-data)', marginTop: '2px' }}>
                      {record.id}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                    <CategoryBadge category={record.category} size="sm" />
                  </td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)', color: 'var(--ns-n700)', fontSize: 'var(--ts-small)' }}>
                    {record.age}
                  </td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                    <RiskBadge level={record.riskLevel} size="sm" showScore score={record.riskScore} />
                  </td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)', color: 'var(--ns-n600)', fontSize: 'var(--ts-small)' }}>
                    {record.screeningDate}
                  </td>
                  <td style={{ padding: 'var(--sp-3) var(--sp-4)', paddingRight: 'var(--panel-pad)', color: 'var(--ns-n600)', fontSize: 'var(--ts-small)' }}>
                    {record.status}
                  </td>
                </tr>
              ))}
              {(summary?.recentCases?.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--ns-n500)' }}>
                    No recent cases found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
