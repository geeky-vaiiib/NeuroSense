import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import { useShap } from '../hooks/useShap';
import { casesApi } from '../services/api';
import { getCategoryContent } from '../data/screeningContent';

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
  metaLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--color-neutral-400)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
};

function FeatureBars({ features }) {
  const maxValue = Math.max(...features.map((item) => Math.abs(item.shapValue)), 0.01);

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {features.map((item) => {
        const pct = Math.abs(item.shapValue) / maxValue;
        const color =
          item.direction === 'positive'
            ? 'var(--color-risk-high)'
            : 'var(--color-risk-low)';

        return (
          <div key={`${item.feature}-${item.shapValue}`} style={{ display: 'grid', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'baseline',
              }}
            >
              <strong style={{ color: 'var(--color-neutral-800)' }}>{item.feature}</strong>
              <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                {item.shapValue > 0 ? '+' : ''}
                {item.shapValue.toFixed(2)}
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
                  width: `${Math.max(pct * 100, 6)}%`,
                  height: '100%',
                  borderRadius: '999px',
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Results() {
  const { caseId: routeCaseId } = useParams();
  const navigate = useNavigate();
  const { explanations, loading: explanationLoading, errors, fetchExplanation, getSortedFeatures } = useShap();

  const [cases, setCases] = useState([]);
  const [detailCache, setDetailCache] = useState({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadCases() {
      setLoadingList(true);
      setPageError('');
      try {
        const list = await casesApi.list();
        if (!active) return;
        setCases(list);
      } catch (error) {
        if (active) {
          setPageError(error.message);
        }
      } finally {
        if (active) {
          setLoadingList(false);
        }
      }
    }

    loadCases();
    return () => {
      active = false;
    };
  }, [navigate, routeCaseId]);

  const selectedCaseId = routeCaseId || cases[0]?.id || '';

  useEffect(() => {
    if (!routeCaseId && cases[0]?.id) {
      navigate(`/app/results/${cases[0].id}`, { replace: true });
    }
  }, [cases, navigate, routeCaseId]);

  useEffect(() => {
    if (!selectedCaseId) return;

    let active = true;
    async function loadCaseDetail() {
      if (detailCache[selectedCaseId]) {
        fetchExplanation(selectedCaseId).catch(() => {});
        return;
      }

      setLoadingDetail(true);
      setPageError('');
      try {
        const detail = await casesApi.get(selectedCaseId);
        if (!active) return;
        setDetailCache((current) => ({ ...current, [selectedCaseId]: detail }));
        fetchExplanation(selectedCaseId).catch(() => {});
      } catch (error) {
        if (active) {
          setPageError(error.message);
        }
      } finally {
        if (active) {
          setLoadingDetail(false);
        }
      }
    }

    loadCaseDetail();
    return () => {
      active = false;
    };
  }, [detailCache, fetchExplanation, selectedCaseId]);

  const selectedSummary = cases.find((item) => item.id === selectedCaseId);
  const selectedCase = detailCache[selectedCaseId] ?? selectedSummary;
  const explanation = explanations[selectedCaseId];
  const features = getSortedFeatures(selectedCaseId);
  const content = selectedCase ? getCategoryContent(selectedCase.category) : null;

  const topMetadata = useMemo(() => {
    if (!selectedCase) return [];
    return [
      ['Case ID', selectedCase.id],
      ['Screening tool', selectedCase.screeningTool],
      ['Model used', selectedCase.modelUsed],
      ['Data source', selectedCase.dataSource === 'mock' ? 'Mock mode' : 'Live model'],
      ['AQ-10 score', `${selectedCase.aq10Score ?? 0}/10`],
      ['Status', selectedCase.status],
    ];
  }, [selectedCase]);

  return (
    <main id="results-page" style={styles.page}>
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
              Category-aware results and explainability
            </h1>
            <p style={{ margin: 0, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
              Every case keeps its adult or child track visible through the result, model,
              explanation, and stored case summary.
            </p>
          </div>
        </div>

        {loadingList ? (
          <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>Loading cases…</p>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/app/results/${item.id}`)}
                style={{
                  minWidth: '210px',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  border: `1px solid ${
                    item.id === selectedCaseId ? 'var(--color-primary)' : 'var(--color-neutral-200)'
                  }`,
                  backgroundColor:
                    item.id === selectedCaseId
                      ? 'var(--color-primary-muted)'
                      : 'var(--color-bg-card)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <CategoryBadge category={item.category} size="sm" />
                  <RiskBadge level={item.riskLevel} size="sm" />
                </div>
                <strong
                  style={{
                    display: 'block',
                    marginTop: '10px',
                    color: 'var(--color-neutral-900)',
                  }}
                >
                  {item.subjectName || 'Unnamed case'}
                </strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-neutral-500)' }}>
                  {item.id}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {(pageError || errors[selectedCaseId]) && (
        <section
          style={{
            ...styles.card,
            borderColor: 'var(--color-risk-high-border)',
            backgroundColor: 'var(--color-risk-high-muted)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--color-risk-high)', fontWeight: 600 }}>
            {pageError || errors[selectedCaseId]}
          </p>
        </section>
      )}

      {selectedCase && content && (
        <>
          <section style={styles.card}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.35fr 1fr',
                gap: '20px',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <CategoryBadge category={selectedCase.category} size="lg" />
                  <RiskBadge level={selectedCase.riskLevel} size="lg" showScore score={selectedCase.riskScore} />
                </div>
                <h2 style={{ margin: '14px 0 8px', color: 'var(--color-neutral-900)' }}>
                  {content.resultsTitle}
                </h2>
                <p style={{ margin: 0, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                  {selectedCase.interpretation}
                </p>
                <div
                  style={{
                    marginTop: '16px',
                    padding: '16px',
                    borderRadius: '16px',
                    border: `1px solid ${content.accentBorder}`,
                    backgroundColor: content.accentSoft,
                    color: 'var(--color-neutral-700)',
                    lineHeight: 1.7,
                  }}
                >
                  {explanation?.summary || 'Generating explanation summary…'}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid var(--color-neutral-200)',
                  borderRadius: '18px',
                  padding: '18px',
                  backgroundColor: 'var(--color-bg)',
                }}
              >
                <p style={{ margin: '0 0 10px', ...styles.metaLabel }}>Attached metadata</p>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {topMetadata.map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ color: 'var(--color-neutral-500)', fontSize: '0.85rem' }}>
                        {label}
                      </span>
                      <strong style={{ color: 'var(--color-neutral-900)', textAlign: 'right' }}>
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: '20px',
            }}
          >
            <div style={styles.card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: 'var(--color-neutral-900)' }}>
                    SHAP feature contributions
                  </h3>
                  <p style={{ margin: '6px 0 0', color: 'var(--color-neutral-500)' }}>
                    Top factors driving the {selectedCase.category} model output.
                  </p>
                </div>
                {explanation?.isMock && (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--color-neutral-100)',
                      color: 'var(--color-neutral-500)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                    }}
                  >
                    mock mode
                  </span>
                )}
              </div>
              {loadingDetail || explanationLoading[selectedCaseId] ? (
                <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>
                  Loading explainability…
                </p>
              ) : (
                <FeatureBars features={features} />
              )}
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              <section style={styles.card}>
                <h3 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
                  Respondent context
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    ['Subject', selectedCase.subjectName || 'No name provided'],
                    ['Respondent', selectedCase.respondentName || 'No name provided'],
                    ['Relationship', selectedCase.respondentRelationship || content.trackSummary],
                    ['Age', selectedCase.age],
                    ['Gender', selectedCase.gender],
                    ['Clinician', selectedCase.clinician || 'Awaiting clinician assignment'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ color: 'var(--color-neutral-500)' }}>{label}</span>
                      <strong style={{ color: 'var(--color-neutral-900)', textAlign: 'right' }}>
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section style={styles.card}>
                <h3 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
                  LIME narrative
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {(explanation?.lime || []).map((item) => (
                    <div
                      key={`${item.feature}-${item.weight}`}
                      style={{
                        paddingBottom: '12px',
                        borderBottom: '1px solid var(--color-neutral-100)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <strong style={{ color: 'var(--color-neutral-800)' }}>{item.feature}</strong>
                        <span style={{ color: 'var(--color-neutral-500)', fontFamily: 'var(--font-mono)' }}>
                          {item.weight > 0 ? '+' : ''}
                          {item.weight.toFixed(2)}
                        </span>
                      </div>
                      <p style={{ margin: '6px 0 0', color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
                        {item.plainEnglish}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section style={styles.card}>
            <h3 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
              Questionnaire snapshot
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {Object.entries(selectedCase.answers || {}).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid var(--color-neutral-200)',
                    backgroundColor: 'var(--color-bg)',
                  }}
                >
                  <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--color-neutral-800)' }}>
                    {key}
                  </p>
                  <p style={{ margin: 0, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
