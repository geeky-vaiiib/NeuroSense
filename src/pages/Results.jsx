import GazeRecordingSummary from '../components/results/GazeRecordingSummary';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import RiskBadge from '../components/RiskBadge';
import { useShap } from '../hooks/useShap';
import { casesApi } from '../services/api';
import { getCategoryContent } from '../data/screeningContent';
import { generatePDF } from '../utils/generatePDF';
import RiskGauge from '../components/results/RiskGauge';
import ScoreMeter from '../components/results/ScoreMeter';
import ModalityStatusGrid from '../components/results/ModalityStatusGrid';
import ResultBasis from '../components/results/ResultBasis';
import SpeechMeasurements from '../components/results/SpeechMeasurements';
import { isServerScored, modalityStates } from '../utils/caseModalities';
import ExplanationPanel from '../components/results/ExplanationPanel';
import ToddlerResults from '../components/results/ToddlerResults';

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
    motion_outside_training_range: 'movement was outside the model\'s training range',
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
    if (gazeStatus === 'out_of_domain') {
      return 'The recording was analysed, but the movement in it is outside the range of the recordings the gaze model was trained on, so no gaze score is reported. It did not affect the result.';
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
    skipped: 'Skipped', insufficient_quality: 'Recorded · not scored', out_of_domain: 'Recorded · outside model range', unavailable: 'Unavailable',
  }[gazeStatus] || 'Not captured';
  const gazeUsedInFusion = selectedCase?.gaze_fusion_eligible === true;
  const isToddler = selectedCase?.category === 'toddler';

  // ── Everything below is read from the stored backend result; nothing is recomputed in the browser ──
  const states = modalityStates(selectedCase);
  const serverScored = isServerScored(selectedCase);
  const qBasis = selectedCase?.questionnaire_basis ?? null;
  const speechFeatures = selectedCase?.speech_features || null;
  const speechState = states.find((m) => m.id === 'speech');
  const legacyProbability = selectedCase?.fusion_score ?? selectedCase?.questionnaire_probability ?? selectedCase?.riskScore ?? null;

  const topMetadata = selectedCase
    ? [
        ['Case ID', selectedCase.id],
        ['Screening tool', selectedCase.screeningTool],
        ['Instrument score', qBasis ? `${qBasis.total_score}/${qBasis.max_score} (threshold ≥ ${qBasis.threshold})` : `${selectedCase.aq10Score ?? 0}/10 (older record)`],
        ['Scoring', serverScored ? 'Server-computed' : 'Older record (not re-scored)'],
        ['ML model (explanation only)', selectedCase.modelUsed],
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
              The questionnaire score and threshold, the status of each other signal, and how the score was formed. Screening
              support for a qualified reviewer — not a diagnosis.
            </p>
          </div>
          <button id="download-pdf-btn" onClick={handleDownloadPDF} disabled={pdfLoading || !selectedCase || !explanation || selectedCase?.category === 'toddler'} className="btn btn-secondary">
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
                  <RiskBadge level={item.riskLevel} category={item.category} size="sm" />
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

      {selectedCase && isToddler && detailCache[selectedCaseId] && (
        <ToddlerResults c={selectedCase} explanation={explanation} explanationLoading={explanationLoading[selectedCaseId]} />
      )}

      {selectedCase && content && !isToddler && (
        <>
          {/* ── Screening insight hero ─────────────────────────── */}
          <section className="ns-dark ns-insight" aria-labelledby="insight-title">
            <div className="ns-insight__gauge">
              {serverScored && qBasis
                ? <ScoreMeter basis={qBasis} level={selectedCase.riskLevel} />
                : <RiskGauge value={legacyProbability} level={selectedCase.riskLevel} size={280} />}
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
                {serverScored ? (selectedCase.confidence_note || '') : 'Older record: the indicator shown is a stored model output from an earlier version, not an independently validated probability.'}
              </p>
            </div>
          </section>

          {/* ── Modality status ────────────────────────────────── */}
          <section aria-labelledby="signals-title">
            <h2 id="signals-title" style={{ fontSize: '1.15rem', marginBottom: 6 }}>Signals and their status</h2>
            <p style={{ margin: '0 0 14px', color: 'var(--ns-n500)', fontSize: '0.86rem', maxWidth: '70ch' }}>
              Only the questionnaire score is used for the result. Gaze, speech and facial analysis are shown for transparency; they are experimental or unavailable and cannot change it.
            </p>
            <ModalityStatusGrid states={states} />
          </section>

          {/* ── How the result was determined ──────────────────── */}
          {serverScored && selectedCase.screening_result && (
            <section className="ns-dark" style={{ borderRadius: 'var(--r-lg)', padding: 'clamp(20px, 3vw, 32px)' }} aria-labelledby="fusion-title">
              <p className="ns-eyebrow ns-eyebrow--dark">How the result was determined</p>
              <h2 id="fusion-title" style={{ fontSize: '1.25rem', marginTop: 8, marginBottom: 18 }}>Score against threshold — no combined probability</h2>
              <ResultBasis result={selectedCase.screening_result} />
            </section>
          )}

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
              scoreExplanation={explanation?.scoreExplanation}
              modelExplanation={explanation?.modelExplanation}
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
            {qBasis && (
              <p role="note" style={{ margin: '0 0 14px', color: 'var(--ns-n600)', fontSize: '0.88rem', lineHeight: 1.6 }}>
                <strong>{qBasis.instrument} total: {qBasis.total_score}/{qBasis.max_score}</strong> (the training labels flag totals of {qBasis.threshold} or more). {qBasis.notice}
              </p>
            )}
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
                      Experimental model output (not used for the result)
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
                    ['Experimental output', gazeFeatures?.prediction === 'asd_signal' ? 'above the model cut-off (not diagnostic)' : gazeFeatures?.prediction === 'typical_signal' ? 'below the model cut-off (not diagnostic)' : '—'],
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
                    Experimental: this output is never used for the screening result.
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
            {!isToddler && gazeStatus && (
              <GazeRecordingSummary quality={gazeQuality} descriptive={gazeFeatures?.descriptive} />
            )}
          </section>

          {/* ── Speech: measurements + honest status (no score) ──── */}
          <SpeechMeasurements state={speechState} features={speechFeatures} />

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
