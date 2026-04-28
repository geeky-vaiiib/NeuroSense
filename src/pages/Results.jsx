import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import { useShap } from '../hooks/useShap';
import { casesApi } from '../services/api';
import { getCategoryContent } from '../data/screeningContent';
import { generatePDF } from '../utils/generatePDF';

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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  async function handleDownloadPDF() {
    if (!selectedCase || !explanation) return;
    setPdfLoading(true);
    try {
      await generatePDF(selectedCase, explanation);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }

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

  useEffect(() => {
    if (!selectedCaseId) return;
    const saved = localStorage.getItem(`ns_notes_${selectedCaseId}`);
    setClinicianNotes(saved || selectedCase?.notes || '');
    setNotesSaved(false);
  }, [selectedCaseId, selectedCase]);

  function handleSaveNotes() {
    localStorage.setItem(`ns_notes_${selectedCaseId}`, clinicianNotes);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2500);
  }

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
          <button
            id="download-pdf-btn"
            onClick={handleDownloadPDF}
            disabled={pdfLoading || !selectedCase || !explanation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid var(--color-neutral-200)',
              backgroundColor: pdfLoading ? 'var(--color-neutral-100)' : '#fff',
              color: 'var(--color-neutral-700)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: pdfLoading || !selectedCase ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {pdfLoading ? (
              <>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--color-neutral-300)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>

        {loadingList ? (
          <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>Loading cases…</p>
        ) : cases.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            padding: '40px 20px',
            textAlign: 'center',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--color-neutral-700)' }}>No screening results yet</p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-neutral-400)', lineHeight: 1.6 }}>
                Complete an adult, child, or toddler screening to generate your first result and explainability report.
              </p>
            </div>
            <button
              onClick={() => navigate('/app/screening')}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Start a screening →
            </button>
          </div>
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

          <section style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-neutral-200)',
            borderRadius: '22px',
            padding: '24px',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: 'var(--color-neutral-900)' }}>Clinician Notes</h3>
                <p style={{ margin: 0, color: 'var(--color-neutral-500)', fontSize: '0.85rem' }}>
                  Notes are stored locally and attached to this case ID. They are not transmitted to the backend.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {notesSaved && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Saved
                  </span>
                )}
                <button
                  id="save-notes-btn"
                  onClick={handleSaveNotes}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Save Notes
                </button>
              </div>
            </div>
            <textarea
              id="clinician-notes-input"
              value={clinicianNotes}
              onChange={(e) => { setClinicianNotes(e.target.value); setNotesSaved(false); }}
              placeholder="Add clinical observations, referral notes, or follow-up plans here…"
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-neutral-200)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-neutral-800)',
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-neutral-200)'}
            />
          </section>
        </>
      )}
    </main>
  );
}
