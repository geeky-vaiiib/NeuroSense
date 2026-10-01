import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import { useShap } from '../hooks/useShap';
import { casesApi } from '../services/api';
import { getCategoryContent } from '../data/screeningContent';
import { generatePDF } from '../utils/generatePDF';
import RiskGauge from '../components/results/RiskGauge';
import FusionVisualization from '../components/results/FusionVisualization';
import ExplanationPanel from '../components/results/ExplanationPanel';
import StatusBadge from '../components/ui/StatusBadge';

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    backgroundColor: 'var(--ns-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: '22px',
    padding: '24px',
    boxShadow: 'none',
  },
  metaLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--ns-n400)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
};

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
    const notesVal = saved || detailCache[selectedCaseId]?.notes || '';
    queueMicrotask(() => {
      setClinicianNotes(notesVal);
      setNotesSaved(false);
    });
  }, [selectedCaseId, detailCache]);

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

  // Gaze data from case record
  const gazeFeatures = selectedCase?.gaze_features || selectedCase?.gazeFeatures || null;
  const gazeInterpretation = selectedCase?.gaze_interpretation || selectedCase?.gazeInterpretation || '';
  const gazeMock = selectedCase?.gaze_mock ?? selectedCase?.gazeMock ?? true;
  const gazeSkipped = selectedCase?.gaze_skipped ?? selectedCase?.gazeSkipped ?? false;
  // Backend gaze result (cases created before the browser gaze model have no gaze_status).
  const gazeStatus = selectedCase?.gaze_status ?? null;
  const gazeScore = selectedCase?.gaze_score ?? null;
  const gazeQuality = selectedCase?.gaze_quality ?? null;
  const gazeModelVersion = selectedCase?.gaze_model_version ?? null;
  const gazeReason = selectedCase?.gaze_reason ?? null;
  const legacyGazeFeatures = gazeFeatures && typeof gazeFeatures === 'object' && Object.keys(gazeFeatures).length > 0;
  const hasGazeData = gazeStatus ? gazeStatus === 'success' : legacyGazeFeatures;
  const GAZE_REASON_TEXT = {
    face_not_detected: 'the face was not detected for much of the recording',
    low_tracking_confidence: 'face-tracking confidence was too low',
    too_many_invalid_frames: 'too many frames could not be tracked',
    recording_too_short: 'the recording was too short',
    too_few_usable_windows: 'too little continuous, well-tracked footage was recorded',
    tracking_not_continuous: 'tracking was interrupted too often',
    corrupt_video: 'the recording could not be read',
    openface_unavailable: 'OpenFace is not installed on the server',
    openface_failed: 'the server could not extract gaze features',
    model_unavailable: 'the gaze model is unavailable',
    poor_calibration: 'the eye-tracking calibration was not accurate enough',
    calibration_incomplete: 'calibration was not completed',
    insufficient_samples: 'too few gaze samples were recorded',
    insufficient_valid_samples: 'too many gaze samples were unusable',
    insufficient_usable_duration: 'not enough continuous gaze data was recorded',
    inconsistent_timestamps: 'the recording timing was inconsistent',
  };
  const gazeUnavailableText = (() => {
    if (gazeStatus === 'skipped' || (!gazeStatus && gazeSkipped)) {
      const why = {
        calibration_poor: 'The gaze step was stopped because eye-tracking calibration was not accurate enough.',
        calibration_failed: 'The gaze step was stopped because calibration could not reach a usable accuracy after several attempts.',
        face_not_detected: 'The gaze step was stopped because the camera could not detect the face.',
        camera_permission_denied: 'The gaze step was not run because camera permission was denied.',
        no_camera: 'The gaze step was not run because no camera was found.',
        camera_in_use: 'The gaze step was not run because the camera was in use by another application.',
        insecure_context: 'The gaze step was not run because the page was not served over HTTPS or localhost.',
        face_model_load_failed: 'The gaze step was not run because the face-tracking model could not load.',
        video_not_ready: 'The gaze step was not run because the camera produced no video.',
        insufficient_data: 'The gaze step ended because too little gaze data was captured.',
        model_unavailable: 'The gaze step was not run because the gaze model is unavailable on the server.',
        camera_denied: 'The gaze step was not run because camera access was denied.',
        camera_unavailable: 'The gaze step was not run because no usable camera was found.',
        engine_load_failed: 'The gaze step was not run because the eye-tracking library could not load.',
        engine_init_failed: 'The gaze step was not run because the eye-tracking engine failed to start.',
        backend_unavailable: 'Gaze data was captured but the analysis server could not be reached.',
        backend_timeout: 'Gaze data was captured but the analysis timed out.',
      }[gazeReason];
      return why || 'Gaze session was skipped by the respondent.';
    }
    if (gazeStatus === 'insufficient_quality') {
      return `Gaze data was recorded but could not be scored: ${GAZE_REASON_TEXT[gazeReason] || gazeReason || 'quality too low'}. `
        + `(${gazeQuality?.valid_sample_count ?? 0} of ${gazeQuality?.sample_count ?? 0} frames usable.) It did not affect the result.`;
    }
    if (gazeStatus === 'unavailable') {
      return `The gaze model could not score this session (${gazeReason || 'unknown reason'}). It did not affect the result.`;
    }
    return 'Gaze session was not completed for this case.';
  })();
  const gazeBadgeText = {
    skipped: 'Skipped', insufficient_quality: 'Recorded · not scored', unavailable: 'Unavailable',
  }[gazeStatus] || 'Not captured';
  const gazeUsedInFusion = selectedCase?.gaze_fusion_eligible === true;
  const isToddler = false;

  // Speech data from case record
  const speechFeatures = selectedCase?.speech_features || selectedCase?.speechFeatures || null;
  const speechInterpretation = selectedCase?.speech_interpretation || selectedCase?.speechInterpretation || '';
  const speechMock = selectedCase?.speech_mock ?? selectedCase?.speechMock ?? true;
  const speechSkipped = selectedCase?.speech_skipped ?? selectedCase?.speechSkipped ?? false;
  const speechFlags = selectedCase?.speech_flags || selectedCase?.speechFlags || [];
  const hasSpeechData = speechFeatures && typeof speechFeatures === 'object' && Object.keys(speechFeatures).length > 0;

  // ── Modality cards: everything below is read from the stored backend result ──
  const bMap = Object.fromEntries((selectedCase?.modality_breakdown || []).map((c) => [c.modality, c]));
  const pct = (v) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : null);
  const qProb = selectedCase?.questionnaire_probability ?? selectedCase?.riskScore ?? null;
  const gazeQ = gazeQuality;
  const otherModality = (id, label) => {
    const c = bMap[id];
    const has = Boolean(c?.available);
    const used = has && c?.isTrainedModel === true;
    return {
      id, label, available: has, used, probability: has ? c.score : null, contribution: c?.contribution,
      stateLabel: !has ? 'Skipped or unavailable' : used ? 'Scored · used' : 'Scored · supplemental',
      tone: !has ? 'muted' : used ? 'ok' : 'warn',
      quality: has ? 'Quality not reported' : null,
      detail: !has ? 'No usable signal for this session, so it did not affect the result.'
        : used ? `Probability ${pct(c.score)}; contributes ${pct(c.contribution) ?? 'a share'} of the final result.`
        : `Probability ${pct(c.score)} is shown for context and did not influence the final result.`,
    };
  };
  const insightItems = selectedCase ? [
    {
      id: 'questionnaire', label: 'Questionnaire', available: true, used: true, probability: qProb, contribution: bMap.questionnaire?.contribution,
      stateLabel: 'Scored · used', tone: 'ok', quality: `AQ-10 score ${selectedCase.aq10Score ?? 0}/10`,
      detail: `Probability ${pct(qProb) ?? '—'}; contributes ${pct(bMap.questionnaire?.contribution) ?? 'a share'} of the final result.`,
    },
    (() => {
      const ok = gazeStatus === 'success';
      const label = ok ? (gazeUsedInFusion ? 'Scored · used' : 'Scored · supplemental')
        : gazeStatus === 'skipped' ? 'Skipped' : gazeStatus === 'insufficient_quality' ? 'Not scored · low quality'
        : gazeStatus === 'unavailable' ? 'Model unavailable' : 'Not captured';
      return {
        id: 'gaze', label: 'Gaze', available: ok, used: ok && gazeUsedInFusion, probability: ok ? gazeScore : null, contribution: bMap.gaze?.contribution,
        stateLabel: label, tone: ok ? (gazeUsedInFusion ? 'ok' : 'warn') : 'muted',
        quality: gazeQ ? `${gazeQ.valid_sample_count}/${gazeQ.sample_count} usable frames${gazeQ.data_quality_score != null ? ` · data quality ${Math.round(gazeQ.data_quality_score * 100)}%` : ''}` : null,
        detail: ok ? (gazeUsedInFusion ? `Probability ${pct(gazeScore)}; contributes ${pct(bMap.gaze?.contribution) ?? 'a share'} of the final result.`
          : `Probability ${pct(gazeScore)} is shown for context; it did not influence the result${gazeFeatures?.fusion_reason ? ` (${gazeFeatures.fusion_reason})` : ''}.`)
          : gazeUnavailableText,
      };
    })(),
    otherModality('speech', 'Speech'),
  ] : [];
  const finalValue = selectedCase ? (selectedCase.fusion_score ?? selectedCase.fusionScore ?? null) : null;

  const topMetadata = selectedCase
    ? [
        ['Case ID', selectedCase.id],
        ['Screening tool', selectedCase.screeningTool],
        ['Model used', selectedCase.modelUsed],
        ['Data source', selectedCase.dataSource === 'mock' ? 'Mock mode' : 'Live model'],
        ['AQ-10 score', `${selectedCase.aq10Score ?? 0}/10`],
        ['Status', selectedCase.status],
      ]
    : [];

  return (
    <main id="results-page" style={styles.page}>
      <section className="panel">
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
            <p className="ns-eyebrow" style={{ marginBottom: 8 }}>Results &amp; explainability</p>
            <h1 style={{ margin: '0 0 6px', color: 'var(--ns-n900)', letterSpacing: '-0.03em' }}>
              Screening insight
            </h1>
            <p style={{ margin: 0, color: 'var(--ns-n600)', lineHeight: 1.7 }}>
              The overall indicator, what each signal contributed, and why. Screening support for
              a qualified reviewer — not a diagnosis.
            </p>
          </div>
          <button id="download-pdf-btn" onClick={handleDownloadPDF} disabled={pdfLoading || !selectedCase || !explanation} className="btn btn-secondary">
            {pdfLoading ? (
              <>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--ns-n300)', borderTopColor: 'var(--ns-instrument)', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
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
          <p style={{ margin: 0, color: 'var(--ns-n500)' }}>Loading cases…</p>
        ) : cases.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            padding: '40px 20px',
            textAlign: 'center',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ns-n300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--ns-n700)' }}>No screening results yet</p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ns-n400)', lineHeight: 1.6 }}>
                Complete an adult, child, or toddler screening to generate your first result and explainability report.
              </p>
            </div>
            <button onClick={() => navigate('/app/screening')} className="btn btn-primary">
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
                    item.id === selectedCaseId ? 'var(--ns-instrument)' : 'var(--border-color)'
                  }`,
                  backgroundColor:
                    item.id === selectedCaseId
                      ? 'var(--ns-instrument-dim)'
                      : 'var(--ns-panel)',
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
                    color: 'var(--ns-n900)',
                  }}
                >
                  {item.subjectName || 'Unnamed case'}
                </strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--ns-n500)' }}>
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
            borderColor: 'var(--ns-risk-high-border)',
            backgroundColor: 'var(--ns-risk-high-bg)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--ns-risk-high)', fontWeight: 600 }}>
            {pageError || errors[selectedCaseId]}
          </p>
        </section>
      )}

      {selectedCase && content && (
        <>
          {/* ── Screening insight hero ─────────────────────────── */}
          <section className="ns-dark ns-insight" aria-labelledby="insight-title">
            <div className="ns-insight__gauge">
              <RiskGauge value={finalValue} level={selectedCase.riskLevel} size={280} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                <RiskBadge level={selectedCase.riskLevel} size="lg" />
                <CategoryBadge category={selectedCase.category} size="lg" />
              </div>
            </div>
            <div className="ns-insight__body">
              <p className="ns-eyebrow ns-eyebrow--dark">Screening insight</p>
              <h2 id="insight-title" style={{ fontSize: 'clamp(1.35rem, 2.6vw, 1.8rem)', marginTop: 10 }}>{content.resultsTitle}</h2>
              <p style={{ marginTop: 12, lineHeight: 1.7, maxWidth: '62ch' }}>{selectedCase.interpretation}</p>
              {(() => {
                // The backend summary starts with the interpretation; show only what it adds.
                const sm = explanation?.summary;
                const extra = sm ? (sm.startsWith(selectedCase.interpretation) ? sm.slice(selectedCase.interpretation.length).trim() : sm) : '';
                return extra ? (
                  <p style={{ marginTop: 14, paddingLeft: 14, borderLeft: '2px solid var(--ns-signal)', lineHeight: 1.65, maxWidth: '62ch', color: '#C9D5E8' }}>{extra}</p>
                ) : null;
              })()}
              <dl className="ns-insight__meta">
                {topMetadata.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              <p style={{ marginTop: 16, fontSize: '0.76rem', color: '#7F92AF', maxWidth: '62ch' }}>
                {selectedCase.confidence_note || 'The final indicator is computed on the server from the signals that passed quality checks.'}
              </p>
            </div>
          </section>

          {/* ── Signal by signal ───────────────────────────────── */}
          <section aria-labelledby="signals-title">
            <h2 id="signals-title" style={{ fontSize: '1.15rem', marginBottom: 14 }}>Signals behind the result</h2>
            <div className="ns-signal-grid">
              {insightItems.map((it) => (
                <article key={it.id} className="ns-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, opacity: it.available ? 1 : 0.92 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: '0.98rem' }}>{it.label}</h3>
                    <StatusBadge tone={it.tone}>{it.stateLabel}</StatusBadge>
                  </div>
                  <div style={{ minHeight: 44, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    {it.probability !== null && it.probability !== undefined ? (
                      <><span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.9rem', fontWeight: 600, letterSpacing: '-0.03em' }}>{Math.round(it.probability * 100)}</span><span style={{ color: 'var(--ns-n500)' }}>%</span></>
                    ) : (
                      <span style={{ color: 'var(--ns-n400)', fontWeight: 500 }}>Unavailable</span>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--ns-n500)', marginBottom: 5 }}>
                      <span>Share of final result</span>
                      <span style={{ fontFamily: 'var(--font-data)' }}>{it.used ? (pct(it.contribution) ?? '—') : 'none'}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 6, background: 'var(--ns-n150)', overflow: 'hidden' }} aria-hidden="true">
                      <div style={{ width: it.used && typeof it.contribution === 'number' ? `${it.contribution * 100}%` : 0, height: '100%', background: 'var(--ns-instrument)', transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--ns-n500)', maxWidth: 'none', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--ns-n700)' }}>Data quality:</strong> {it.quality || 'not applicable'}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* ── Fusion ─────────────────────────────────────────── */}
          <section className="ns-dark" style={{ borderRadius: 'var(--r-lg)', padding: 'clamp(20px, 3vw, 32px)' }} aria-labelledby="fusion-title">
            <p className="ns-eyebrow ns-eyebrow--dark">Multimodal fusion</p>
            <h2 id="fusion-title" style={{ fontSize: '1.25rem', marginTop: 8, marginBottom: 18 }}>How the signals combined</h2>
            <FusionVisualization
              items={insightItems.map((i) => ({ ...i, contribution: typeof i.contribution === 'number' ? i.contribution : 0 }))}
              finalValue={finalValue}
              level={selectedCase.riskLevel}
            />
          </section>

          {/* ── Why (SHAP / LIME) + context ────────────────────── */}
          <section className="ns-why-grid">
            <ExplanationPanel
              features={features}
              lime={explanation?.lime}
              summary={explanation?.summary}
              loading={loadingDetail || explanationLoading[selectedCaseId]}
              error={errors[selectedCaseId]}
              modelUsed={selectedCase.modelUsed}
              isMock={explanation?.isMock}
              category={selectedCase.category}
            />
            <aside className="ns-card" style={{ padding: 24, alignSelf: 'start' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>Respondent context</h3>
              <dl style={{ display: 'grid', gap: 12, margin: 0 }}>
                {[
                  ['Subject', selectedCase.subjectName || 'No name provided'],
                  ['Respondent', selectedCase.respondentName || 'No name provided'],
                  ['Relationship', selectedCase.respondentRelationship || content.trackSummary],
                  ['Age', selectedCase.age],
                  ['Gender', selectedCase.gender],
                  ['Clinician', selectedCase.clinician || 'Awaiting assignment'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.86rem' }}>
                    <dt style={{ color: 'var(--ns-n500)' }}>{label}</dt>
                    <dd style={{ margin: 0, fontWeight: 600, color: 'var(--ns-n900)', textAlign: 'right' }}>{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0, color: 'var(--ns-n900)' }}>
              Questionnaire snapshot
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {Object.entries(selectedCase.answers || {}).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: '14px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--ns-surface-2)',
                  }}
                >
                  <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--ns-n800)' }}>
                    {key}
                  </p>
                  <p style={{ margin: 0, color: 'var(--ns-n600)', lineHeight: 1.6 }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Gaze Analysis Section ────────────────────────────── */}
          <section className="panel">
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
                <h3 style={{ margin: 0, color: 'var(--ns-n900)' }}>
                  Gaze Analysis
                </h3>
                <p style={{ margin: '6px 0 0', color: 'var(--ns-n500)' }}>
                  OpenFace gaze and head-pose measurements from the 30-second visual task, scored by a model trained on the DASD dataset.
                </p>
              </div>
              {hasGazeData ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: gazeMock
                      ? 'var(--ns-risk-mod-bg)'
                      : 'var(--ns-signal-dim)',
                    color: gazeMock
                      ? 'var(--ns-risk-mod)'
                      : 'var(--ns-instrument)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {gazeStatus ? 'OpenFace webcam model' : (gazeMock ? 'Heuristic model' : 'Live session')}
                </span>
              ) : (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--ns-surface-2)',
                    color: 'var(--ns-n500)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {gazeBadgeText}
                </span>
              )}
            </div>

            {hasGazeData ? (
              <>
                {/* Score progress bar */}
                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ color: 'var(--ns-n600)', fontSize: '0.85rem' }}>
                      Gaze model output (screening signal)
                    </span>
                    <strong
                      style={{
                        fontFamily: 'var(--font-data)',
                        color: 'var(--ns-n900)',
                      }}
                    >
                      {gazeScore != null ? (gazeScore * 100).toFixed(0) + '%' : 'N/A'}
                    </strong>
                  </div>
                  <div
                    style={{
                      height: '10px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--ns-surface-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min((gazeScore || 0) * 100, 100)}%`,
                        height: '100%',
                        borderRadius: '999px',
                        backgroundColor: 'var(--ns-instrument)',
                        transition: 'width 600ms ease',
                      }}
                    />
                  </div>
                </div>

                {/* Feature table */}
                <div
                  style={{
                    display: 'grid',
                    gap: '10px',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--ns-surface-2)',
                  }}
                >
                  {(gazeStatus ? [
                    ['Model', gazeModelVersion || 'n/a'],
                    ['Data quality', gazeQuality?.data_quality_score != null ? `${Math.round(gazeQuality.data_quality_score * 100)}%` : '—'],
                    ['Frames', gazeQuality ? `${gazeQuality.valid_sample_count}/${gazeQuality.sample_count} usable` : '—'],
                    ['Duration', gazeQuality?.duration_seconds != null ? `${gazeQuality.duration_seconds}s` : '—'],
                    ['Windows scored', gazeFeatures?.windows_scored != null ? String(gazeFeatures.windows_scored) : '—'],
                    ['Signal', gazeFeatures?.prediction === 'asd_signal' ? 'Higher-risk gaze pattern' : gazeFeatures?.prediction === 'typical_signal' ? 'Lower-risk gaze pattern' : '—'],
                    ['Features used', Array.isArray(gazeFeatures?.features_used) ? gazeFeatures.features_used.join(', ') : '—'],
                    ['Status', 'Analyzed'],
                  ] : [
                    [
                      'Social attention ratio',
                      gazeFeatures.social_attention_ratio != null
                        ? `${(gazeFeatures.social_attention_ratio * 100).toFixed(0)}%`
                        : '—',
                    ],
                    [
                      'Mean fixation duration',
                      gazeFeatures.mean_fixation_duration != null
                        ? `${gazeFeatures.mean_fixation_duration.toFixed(0)} ms`
                        : '—',
                    ],
                    [
                      'Gaze variability',
                      gazeFeatures.gaze_variability != null
                        ? gazeFeatures.gaze_variability.toFixed(2)
                        : '—',
                    ],
                    [
                      'Scanpath length',
                      gazeFeatures.scanpath_length != null
                        ? gazeFeatures.scanpath_length.toFixed(2)
                        : '—',
                    ],
                    [
                      'Stimulus transitions',
                      gazeFeatures.stimulus_transitions != null
                        ? String(gazeFeatures.stimulus_transitions)
                        : '—',
                    ],
                  ]).map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <span style={{ color: 'var(--ns-n500)', fontSize: '0.85rem' }}>
                        {label}
                      </span>
                      <strong
                        style={{
                          color: 'var(--ns-n900)',
                          fontFamily: 'var(--font-data)',
                          fontSize: '0.85rem',
                          textAlign: 'right',
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                {gazeStatus === 'success' && (
                  <p style={{ marginTop: '12px', fontSize: '0.85rem', fontWeight: 600, color: gazeUsedInFusion ? 'var(--ns-instrument)' : 'var(--ns-risk-mod)' }}>
                    {gazeUsedInFusion
                      ? 'Included in the final probability.'
                      : `Recorded and scored, but NOT included in the final probability${gazeFeatures?.fusion_reason ? `: ${gazeFeatures.fusion_reason}` : ''}.`}
                  </p>
                )}
                {gazeStatus && (
                  <p style={{ marginTop: '12px', color: 'var(--ns-n500)', fontSize: '0.8rem', fontFamily: 'var(--font-data)' }}>
                    Model {gazeModelVersion || 'n/a'}
                    {gazeQuality
                      ? ` · ${gazeQuality.valid_sample_count}/${gazeQuality.sample_count} usable frames · tracking continuity ${Math.round((gazeQuality.tracking_continuity ?? 0) * 100)}%`
                      : ''}
                  </p>
                )}

                {/* Interpretation */}
                {gazeInterpretation && (
                  <p
                    style={{
                      marginTop: '14px',
                      color: 'var(--ns-n600)',
                      lineHeight: 1.7,
                      fontSize: '0.9rem',
                    }}
                  >
                    {gazeInterpretation}
                  </p>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--ns-surface-2)',
                  color: 'var(--ns-n400)',
                }}
              >
                {isToddler
                  ? 'Gaze session is not available for the toddler track.'
                  : gazeUnavailableText}
              </div>
            )}
          </section>

          {/* ── Speech Analysis Section ───────────────────────────── */}
          <section className="panel">
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
                <h3 style={{ margin: 0, color: 'var(--ns-n900)' }}>
                  Speech Analysis
                </h3>
                <p style={{ margin: '6px 0 0', color: 'var(--ns-n500)' }}>
                  Acoustic features from the 20-second speech sample.
                </p>
              </div>
              {hasSpeechData ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: speechMock
                      ? 'var(--ns-risk-mod-bg)'
                      : 'var(--ns-signal-dim)',
                    color: speechMock
                      ? 'var(--ns-risk-mod)'
                      : 'var(--ns-instrument)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {speechMock ? 'Heuristic model' : 'Acoustic analysis'}
                </span>
              ) : (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--ns-surface-2)',
                    color: 'var(--ns-n500)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  Not captured
                </span>
              )}
            </div>

            {hasSpeechData ? (
              <>
                {/* Score progress bar */}
                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ color: 'var(--ns-n600)', fontSize: '0.85rem' }}>
                      Speech risk score
                    </span>
                    <strong
                      style={{
                        fontFamily: 'var(--font-data)',
                        color: 'var(--ns-n900)',
                      }}
                    >
                      {selectedCase.riskScore != null
                        ? ((selectedCase.riskScore) * 100).toFixed(0) + '%'
                        : 'N/A'}
                    </strong>
                  </div>
                  <div
                    style={{
                      height: '10px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--ns-surface-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min((selectedCase.riskScore || 0) * 100, 100)}%`,
                        height: '100%',
                        borderRadius: '999px',
                        backgroundColor: '#C98B2E',
                        transition: 'width 600ms ease',
                      }}
                    />
                  </div>
                </div>

                {/* Feature table */}
                <div
                  style={{
                    display: 'grid',
                    gap: '10px',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--ns-surface-2)',
                  }}
                >
                  {[
                    [
                      'Pitch variability',
                      speechFeatures.pitch_std != null
                        ? `${speechFeatures.pitch_std.toFixed(1)} Hz`
                        : '\u2014',
                    ],
                    [
                      'Voiced fraction',
                      speechFeatures.voiced_fraction != null
                        ? `${(speechFeatures.voiced_fraction * 100).toFixed(0)}%`
                        : '\u2014',
                    ],
                    [
                      'Speech rate',
                      speechFeatures.speech_rate != null
                        ? `${speechFeatures.speech_rate.toFixed(1)} syll/sec`
                        : '\u2014',
                    ],
                    [
                      'Mean energy',
                      speechFeatures.energy_mean != null
                        ? speechFeatures.energy_mean.toFixed(4)
                        : '\u2014',
                    ],
                    [
                      'MFCC-1 mean',
                      speechFeatures.mfcc_mean && speechFeatures.mfcc_mean.length > 1
                        ? speechFeatures.mfcc_mean[1].toFixed(1)
                        : '\u2014',
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <span style={{ color: 'var(--ns-n500)', fontSize: '0.85rem' }}>
                        {label}
                      </span>
                      <strong
                        style={{
                          color: 'var(--ns-n900)',
                          fontFamily: 'var(--font-data)',
                          fontSize: '0.85rem',
                          textAlign: 'right',
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Clinical flags */}
                {speechFlags && speechFlags.length > 0 && (
                  <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {speechFlags.map((flag, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          background: '#FEF3C7',
                          color: '#92400E',
                          borderRadius: '20px',
                          fontWeight: 600,
                        }}
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Interpretation */}
                {speechInterpretation && (
                  <p
                    style={{
                      marginTop: '14px',
                      color: 'var(--ns-n600)',
                      lineHeight: 1.7,
                      fontSize: '0.9rem',
                    }}
                  >
                    {speechInterpretation}
                  </p>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--ns-surface-2)',
                  color: 'var(--ns-n400)',
                }}
              >
                {isToddler
                  ? 'Speech session is not available for the toddler track.'
                  : speechSkipped
                    ? 'Speech session was skipped by the respondent.'
                    : 'Speech session was skipped or not available for this track.'}
              </div>
            )}
          </section>

          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: 'var(--ns-n900)' }}>Clinician Notes</h3>
                <p style={{ margin: 0, color: 'var(--ns-n500)', fontSize: '0.85rem' }}>
                  Notes are stored locally and attached to this case ID. They are not transmitted to the backend.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {notesSaved && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--ns-instrument)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Saved
                  </span>
                )}
                <button id="save-notes-btn" onClick={handleSaveNotes} className="btn btn-primary">
                  Save Notes
                </button>
              </div>
            </div>
            <textarea
              id="clinician-notes-input"
              className="field-input"
              value={clinicianNotes}
              onChange={(e) => { setClinicianNotes(e.target.value); setNotesSaved(false); }}
              placeholder="Add clinical observations, referral notes, or follow-up plans here…"
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--ns-surface-2)',
                color: 'var(--ns-n800)',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--ns-instrument)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
          </section>
        </>
      )}
      <style>{`
        .ns-insight{display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(20px,4vw,52px);align-items:center;border-radius:var(--r-lg);padding:clamp(22px,4vw,44px);position:relative;overflow:hidden;border:1px solid rgba(148,163,184,.16)}
        .ns-insight::before{content:"";position:absolute;inset:0;background:radial-gradient(520px 320px at 12% 40%,rgba(34,211,238,.12),transparent 70%);pointer-events:none}
        .ns-insight>*{position:relative}
        .ns-insight__gauge{display:flex;flex-direction:column;align-items:center;gap:10px}
        .ns-insight__meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px 22px;margin:22px 0 0;padding-top:20px;border-top:1px solid rgba(148,163,184,.18)}
        .ns-insight__meta dt{font-family:var(--font-data);font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:#7F92AF}
        .ns-insight__meta dd{margin:3px 0 0;font-size:.88rem;font-weight:600;color:#E6ECF5;word-break:break-word}
        .ns-signal-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
        .ns-why-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:20px;align-items:start}
        @media (max-width:1100px){.ns-signal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ns-why-grid{grid-template-columns:1fr}}
        @media (max-width:760px){.ns-insight{grid-template-columns:1fr;text-align:left}.ns-insight__gauge{align-items:center}}
        @media (max-width:520px){.ns-signal-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
