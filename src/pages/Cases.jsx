import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import Modal from '../components/Modal';
import RiskBadge from '../components/RiskBadge';
import { casesApi } from '../services/api';

const CATEGORY_FILTERS = ['all', 'adult', 'child'];
const RISK_FILTERS = ['all', 'High', 'Moderate', 'Low'];

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
        backgroundColor: active ? 'var(--color-primary-muted)' : '#fff',
        color: active ? 'var(--color-primary-dark)' : 'var(--color-neutral-600)',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function CaseCard({ record, onOpen, onViewResults }) {
  return (
    <article
      style={{
        border: '1px solid var(--color-neutral-200)',
        borderRadius: '20px',
        padding: '18px',
        backgroundColor: 'var(--color-bg-card)',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <CategoryBadge category={record.category} size="sm" />
            <RiskBadge level={record.riskLevel} size="sm" showScore score={record.riskScore} />
          </div>
          <div>
            <strong style={{ color: 'var(--color-neutral-900)' }}>
              {record.subjectName || 'Unnamed case'}
            </strong>
            <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-500)', fontSize: '0.82rem' }}>
              {record.id}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => onViewResults(record.id)} style={{ ...styles.linkButton }}>
          Open result
        </button>
      </div>

      <p style={{ margin: 0, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
        {record.diagnosis}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
        {[
          ['Age', record.age],
          ['Respondent', record.respondentRelationship || 'Not provided'],
          ['Tool', record.screeningTool],
        ].map(([label, value]) => (
          <div key={label}>
            <p style={{ margin: '0 0 4px', color: 'var(--color-neutral-400)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </p>
            <strong style={{ color: 'var(--color-neutral-800)', fontSize: '0.9rem' }}>
              {value}
            </strong>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {record.tags?.map((tag) => (
          <span
            key={tag}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: 'var(--color-neutral-100)',
              color: 'var(--color-neutral-500)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-neutral-500)', fontSize: '0.85rem' }}>
          {record.dataSource === 'mock' ? 'Mock mode case' : 'Live model case'}
        </span>
        <button type="button" onClick={() => onOpen(record)} style={styles.linkButton}>
          View details
        </button>
      </div>
    </article>
  );
}

styles.linkButton = {
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '10px',
  border: '1px solid var(--color-neutral-200)',
  backgroundColor: '#fff',
  color: 'var(--color-neutral-700)',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function Cases() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadCases() {
      setLoading(true);
      setError('');
      try {
        const list = await casesApi.list(
          categoryFilter === 'all' ? {} : { category: categoryFilter }
        );
        if (active) {
          setRecords(list);
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

    loadCases();
    return () => {
      active = false;
    };
  }, [categoryFilter]);

  const filteredRecords = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesRisk = riskFilter === 'all' || record.riskLevel === riskFilter;
      const matchesQuery =
        !loweredQuery ||
        record.id.toLowerCase().includes(loweredQuery) ||
        (record.subjectName || '').toLowerCase().includes(loweredQuery) ||
        (record.respondentName || '').toLowerCase().includes(loweredQuery) ||
        (record.diagnosis || '').toLowerCase().includes(loweredQuery);
      return matchesRisk && matchesQuery;
    });
  }, [query, records, riskFilter]);

  return (
    <main id="cases-page" style={styles.page}>
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
            <h1 style={{ margin: '0 0 6px', color: 'var(--color-neutral-900)' }}>
              Case history
            </h1>
            <p style={{ margin: 0, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
              Filter across adult and child case records without losing category context.
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-500)' }}>
            {filteredRecords.length} case{filteredRecords.length === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by case ID, subject, respondent, or diagnosis"
            style={{
              width: '100%',
              minHeight: '44px',
              padding: '0 14px',
              borderRadius: '12px',
              border: '1px solid var(--color-neutral-200)',
              fontSize: '0.95rem',
            }}
          />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {CATEGORY_FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                label={filter === 'all' ? 'All categories' : `${filter[0].toUpperCase()}${filter.slice(1)}`}
                active={categoryFilter === filter}
                onClick={() => setCategoryFilter(filter)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {RISK_FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                label={filter === 'all' ? 'All risk levels' : filter}
                active={riskFilter === filter}
                onClick={() => setRiskFilter(filter)}
              />
            ))}
          </div>
        </div>
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

      <section style={styles.card}>
        {loading ? (
          <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>Loading case history…</p>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-neutral-500)', padding: '30px 0' }}>
            No cases match the current filters.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
            {filteredRecords.map((record) => (
              <CaseCard
                key={record.id}
                record={record}
                onOpen={setSelectedCase}
                onViewResults={(caseId) => navigate(`/app/results/${caseId}`)}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(selectedCase)}
        onClose={() => setSelectedCase(null)}
        title={selectedCase?.subjectName || 'Case details'}
        subtitle={selectedCase ? `${selectedCase.id} · ${selectedCase.diagnosis}` : ''}
        size="lg"
      >
        {selectedCase && (
          <div style={{ display: 'grid', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <CategoryBadge category={selectedCase.category} size="lg" />
              <RiskBadge level={selectedCase.riskLevel} size="lg" showScore score={selectedCase.riskScore} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              {[
                ['Subject', selectedCase.subjectName || 'No name provided'],
                ['Respondent', selectedCase.respondentName || 'No name provided'],
                ['Relationship', selectedCase.respondentRelationship || 'Not provided'],
                ['Screening date', selectedCase.screeningDate],
                ['Tool', selectedCase.screeningTool],
                ['Data source', selectedCase.dataSource === 'mock' ? 'Mock mode' : 'Live model'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    borderRadius: '16px',
                    border: '1px solid var(--color-neutral-200)',
                    backgroundColor: 'var(--color-bg)',
                    padding: '14px',
                  }}
                >
                  <p style={{ margin: '0 0 6px', color: 'var(--color-neutral-400)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </p>
                  <strong style={{ color: 'var(--color-neutral-900)' }}>{value}</strong>
                </div>
              ))}
            </div>

            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--color-neutral-800)' }}>
                Diagnosis summary
              </p>
              <p style={{ margin: 0, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                {selectedCase.diagnosis}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
