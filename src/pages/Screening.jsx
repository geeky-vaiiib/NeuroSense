import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import ProgressIndicator from '../components/ui/ProgressIndicator';
import QuestionFlow from '../components/screening/QuestionFlow';
import AnalysisState from '../components/screening/AnalysisState';
import GazeSession from '../components/GazeSession';
import SpeechSession from '../components/SpeechSession';
import FacialSession from '../components/FacialSession';
import { useScreening } from '../hooks/useScreening';
import {
  ANSWER_OPTIONS,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  QUESTION_BANK,
  YES_NO_OPTIONS,
  buildAq10Score,
  getCategoryContent,
  validateCategoryAge,
} from '../data/screeningContent';


const BASE_DEMO = {
  subjectName: '',
  respondentName: '',
  respondentRelationship: '',
  age: '',
  gender: 'Prefer not to say',
  ethnicity: '',
  jaundice: 'No',
  familyAsd: 'No',
};

const BASE_CONSENTS = [false, false, false, false];

// Five stages shown to the user; internal wizard steps map onto them.
const STAGES = [
  { id: 'questionnaire', label: 'Questionnaire' },
  { id: 'gaze', label: 'Gaze' },
  { id: 'speech', label: 'Speech' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'results', label: 'Results' },
];
const SUBSTEPS = { 1: 'Consent', 2: 'About the child', 3: 'Questions', 6: 'Facial snapshot', 7: 'Review' };

function FormField({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function Screening() {
  const navigate = useNavigate();
  const { submit, loading, error } = useScreening();

  const [step, setStep] = useState(1);
  const [consents, setConsents] = useState(BASE_CONSENTS);
  const [demo, setDemo] = useState(BASE_DEMO);
  const [answers, setAnswers] = useState({});
  const [gazeSession, setGazeSession] = useState(null);
  const [gazeAnalysis, setGazeAnalysis] = useState(null);
  const [gazeSkipped, setGazeSkipped] = useState(false);
  const [gazeSkipReason, setGazeSkipReason] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcriptHint, setTranscriptHint] = useState('');
  const [speechSkipped, setSpeechSkipped] = useState(false);
  const [facialImage, setFacialImage] = useState(null);
  const [facialSkipped, setFacialSkipped] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const category = 'child';
  const content = getCategoryContent(category);
  const questions = QUESTION_BANK[category];
  const aq10Score = useMemo(() => buildAq10Score(answers, category), [answers, category]);
  const ageCheck = useMemo(() => validateCategoryAge(category, Number(demo.age)), [category, demo.age]);

  const isToddler = false;
  const hasGaze = true;
  const GAZE_STEP = 4;
  const SPEECH_STEP = 5;
  const FACIAL_STEP = 6;
  const REVIEW_STEP = 7;
  // internal step -> displayed stage (0 questionnaire, 1 gaze, 2 speech, 3 analysis)
  const stageIndex = step <= 3 ? 0 : step === GAZE_STEP ? 1 : step === SPEECH_STEP ? 2 : 3;

  

  function updateDemo(key, value) {
    setDemo((current) => ({ ...current, [key]: value }));
    if (key === 'age' || key === 'respondentRelationship') setValidationMessage('');
  }

  function updateConsent(index, checked) {
    setConsents((current) => current.map((value, item) => (item === index ? checked : value)));
  }

  function updateAnswer(questionId, answer) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  const allConsentsAccepted = consents.every(Boolean);
  const demographicsReady = Number(demo.age) >= 0 && demo.gender && Boolean(demo.respondentRelationship);
  const questionnaireReady = questions.every((question) => answers[question.id]);

  const gazeStatusLabel = (() => {
    if (isToddler) return 'N/A — Toddler track';
    if (gazeSkipped) return 'Skipped';
    if (gazeSession && gazeAnalysis?.status === 'success') {
      return `Session recorded (${gazeAnalysis.quality.valid_sample_count} usable samples)`;
    }
    if (gazeSession) return 'Recorded, not usable — reported as not available';
    return 'Not started';
  })();

  const speechStatusLabel = (() => {
    if (isToddler) return 'N/A — Toddler track';
    if (speechSkipped) return 'Skipped';
    if (audioBlob) return '20-second sample recorded';
    return 'Not started';
  })();

  const facialStatusLabel = (() => {
    if (isToddler) return 'N/A — Toddler track';
    if (facialSkipped) return 'Skipped';
    if (facialImage) return 'Image captured';
    return 'Not started';
  })();

  const summaryRows = [
    ['Category', content?.label],
    ['Screening tool', content?.screeningTool],
    ['AQ-10 score', `${aq10Score}/10`],
    ['Submitted for', demo.subjectName || 'No name provided'],
    ['Respondent relationship', demo.respondentRelationship || 'Not provided'],
    ['Age', demo.age || 'Not provided'],
    ['Gender', demo.gender || 'Not provided'],
    ['Eye Gaze', gazeStatusLabel],
    ['Speech Sample', speechStatusLabel],
    ['Facial Expression', facialStatusLabel],
  ];

  async function handlePrimaryAction() {
    if (!category) return;
    if (step === 1) {
      if (!allConsentsAccepted) { setValidationMessage('Please confirm all consent items before continuing.'); return; }
      setValidationMessage(''); setStep(2); return;
    }
    if (step === 2) {
      if (!demographicsReady) { setValidationMessage('Please complete the required demographic fields.'); return; }
      if (!ageCheck.valid) { setValidationMessage(ageCheck.message); return; }
      setValidationMessage(''); setStep(3); return;
    }
    if (step === 3) {
      if (!questionnaireReady) { setValidationMessage('Please answer all ten questionnaire items before continuing.'); return; }
      setValidationMessage(''); setStep(hasGaze ? GAZE_STEP : REVIEW_STEP); return;
    }

    if (step === REVIEW_STEP) {
      try {
        let audioBase64 = null;
        if (audioBlob) {
          if (audioBlob.size > 2_000_000) {
            setSpeechSkipped(true); setAudioBlob(null);
          } else {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
            audioBase64 = btoa(binary);
          }
        }

        const payload = {
          category,
          demo: { ...demo, age: Number(demo.age) },
          answers,
          aq10Score,
          // The server re-analyses the raw session; the client never supplies a probability.
          // A recorded-but-unusable session is still sent so its quality reason is stored.
          gazeSession,
          gazeSkipped,
          gazeSkipReason: gazeSkipped ? gazeSkipReason : null,
          audioBase64: audioBase64,
          audioMimeType: audioBlob?.type || null,
          transcriptHint: transcriptHint,
          speechSkipped,
          facialImageBase64: facialImage,
          facialSkipped,
        };
        const result = await submit(payload);
        navigate(`/app/results/${result.caseId}`);
      } catch {
        // The error is stored and rendered by useScreening; nothing is faked on failure.
      }
    }
  }

  function handleBack() {
    if (step <= 1) {
      setStep(0); navigate('/app/screening', { replace: true }); return;
    }
    setValidationMessage('');
    if (step === REVIEW_STEP && hasGaze) { setStep(3); return; }
    setStep((current) => current - 1);
  }

  return (
    <main id="screening-page" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      {step > 0 && (
        <div style={{ marginBottom: 32 }}>
          <ProgressIndicator steps={STAGES} current={stageIndex} />
          {SUBSTEPS[step] && (
            <p style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--ns-n500)' }}>{SUBSTEPS[step]}</p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        {content && (
          <div className="ns-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            
            {step <= 3 && (
              <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <p className="ns-eyebrow" style={{ marginBottom: 6 }}>{content.screeningTool}</p>
                  <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '-0.03em' }}>{content.introTitle}</h1>
                </div>
                <CategoryBadge category={category} size="md" />
              </header>
            )}

            {step === 1 && (
              <section className="panel">
                <h2 style={{ marginTop: 0, color: 'var(--ns-n900)', fontSize: 'var(--ts-h3)' }}>{content.consentTitle}</h2>
                <p style={{ color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)' }}>{content.consentDescription}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
                  {content.consentItems.map((item, index) => (
                    <label
                      key={item}
                      style={{
                        display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start',
                        padding: 'var(--sp-4)', borderRadius: 'var(--r-md)',
                        border: `1px solid ${consents[index] ? 'var(--ns-instrument)' : 'var(--border-color)'}`,
                        backgroundColor: consents[index] ? 'var(--ns-instrument-dim)' : 'var(--ns-panel)',
                        cursor: 'pointer', transition: 'all var(--ease-fast)'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={consents[index]}
                        onChange={(e) => updateConsent(index, e.target.checked)}
                        style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--ns-instrument)' }}
                      />
                      <span style={{ color: 'var(--ns-n800)', lineHeight: 'var(--lh-body)', fontSize: 'var(--ts-body)' }}>{item}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="panel">
                <h2 style={{ marginTop: 0, color: 'var(--ns-n900)', fontSize: 'var(--ts-h3)' }}>Demographics and context</h2>
                <p style={{ color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)', marginBottom: 'var(--sp-5)' }}>
                  These details stay attached to the case record and influence the AI's explanation.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
                  <FormField label={content.demographics.subjectNameLabel}>
                    <input className="field-input" value={demo.subjectName} onChange={(e) => updateDemo('subjectName', e.target.value)} />
                  </FormField>
                  <FormField label={content.demographics.respondentNameLabel}>
                    <input className="field-input" value={demo.respondentName} onChange={(e) => updateDemo('respondentName', e.target.value)} />
                  </FormField>
                  <FormField label={content.demographics.respondentRelationshipLabel}>
                    <input
                      className="field-input"
                      value={demo.respondentRelationship}
                      disabled={false}
                      onChange={(e) => updateDemo('respondentRelationship', e.target.value)}
                      style={{ backgroundColor: 'var(--ns-panel)' }}
                    />
                  </FormField>
                  <FormField label={content.demographics.ageLabel}>
                    <input className="field-input" type="number" min='4' max='11' value={demo.age} onChange={(e) => updateDemo('age', e.target.value)} />
                  </FormField>
                  <FormField label={content.demographics.genderLabel}>
                    <select className="field-select" value={demo.gender} onChange={(e) => updateDemo('gender', e.target.value)}>
                      {GENDER_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </FormField>
                  <FormField label={content.demographics.ethnicityLabel}>
                    <select className="field-select" value={demo.ethnicity} onChange={(e) => updateDemo('ethnicity', e.target.value)}>
                      <option value="">Select one</option>
                      {ETHNICITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </FormField>
                  <FormField label={content.demographics.jaundiceLabel}>
                    <select className="field-select" value={demo.jaundice} onChange={(e) => updateDemo('jaundice', e.target.value)}>
                      {YES_NO_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </FormField>
                  <FormField label={content.demographics.familyAsdLabel}>
                    <select className="field-select" value={demo.familyAsd} onChange={(e) => updateDemo('familyAsd', e.target.value)}>
                      {YES_NO_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </FormField>
                </div>
                {!ageCheck.valid && <p style={{ marginTop: 'var(--sp-4)', color: 'var(--ns-risk-high)', fontWeight: 'var(--fw-semibold)' }}>{ageCheck.message}</p>}
              </section>
            )}

            {step === 3 && (
              <section className="ns-card" style={{ padding: 'clamp(20px, 4vw, 36px)' }}>
                <p style={{ color: 'var(--ns-n600)', lineHeight: 1.6, marginBottom: 24, fontSize: '0.92rem', maxWidth: 'none' }}>{content.questionnaireDescription}</p>
                <QuestionFlow questions={questions} answers={answers} onAnswer={updateAnswer} options={ANSWER_OPTIONS} />
              </section>
            )}

            {hasGaze && step === GAZE_STEP && (
              <GazeSession
                category={category}
                onComplete={(session, analysis) => { setGazeSession(session); setGazeAnalysis(analysis); setGazeSkipped(false); setStep(SPEECH_STEP); }}
                onSkip={(reason) => { setGazeSession(null); setGazeAnalysis(null); setGazeSkipped(true); setGazeSkipReason(reason || 'user_skipped'); setStep(SPEECH_STEP); }}
              />
            )}

            {hasGaze && step === SPEECH_STEP && (
              <SpeechSession
                category={category}
                onComplete={(blob, hint) => { setAudioBlob(blob); setTranscriptHint(hint || ''); setSpeechSkipped(false); setStep(FACIAL_STEP); }}
                onSkip={() => { setAudioBlob(null); setSpeechSkipped(true); setStep(FACIAL_STEP); }}
              />
            )}

            {hasGaze && step === FACIAL_STEP && (
              <FacialSession
                category={category}
                onComplete={(base64Image) => { setFacialImage(base64Image); setFacialSkipped(false); setStep(REVIEW_STEP); }}
                onSkip={() => { setFacialImage(null); setFacialSkipped(true); setStep(REVIEW_STEP); }}
              />
            )}

            {step === REVIEW_STEP && loading && <AnalysisState />}

            {step === REVIEW_STEP && !loading && (
              <section className="panel">
                <h2 style={{ marginTop: 0, color: 'var(--ns-n900)', fontSize: 'var(--ts-h3)' }}>{content.reviewTitle}</h2>
                <p style={{ color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)', marginBottom: 'var(--sp-5)' }}>{content.reviewDescription}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-3)' }}>
                  {summaryRows.map(([label, value]) => {
                    const isMultimodal = ['Eye Gaze', 'Speech Sample', 'Facial Expression'].includes(label);
                    const hasCapturedData = isMultimodal && (
                      (label === 'Eye Gaze' && gazeAnalysis?.status === 'success' && !gazeSkipped) ||
                      (label === 'Speech Sample' && audioBlob && !speechSkipped) ||
                      (label === 'Facial Expression' && facialImage && !facialSkipped)
                    );

                    return (
                      <div
                        key={label}
                        style={{
                          padding: 'var(--sp-3) var(--sp-4)',
                          borderRadius: 'var(--r-sm)',
                          border: `1px solid ${hasCapturedData ? 'var(--ns-signal-dim)' : 'var(--border-color)'}`,
                          backgroundColor: hasCapturedData ? 'var(--ns-signal-dim)' : 'var(--ns-surface-2)',
                        }}
                      >
                        <p className="field-label" style={{ marginBottom: 'var(--sp-1)' }}>{label}</p>
                        <strong style={{ color: isMultimodal && !hasCapturedData ? 'var(--ns-n500)' : 'var(--ns-n900)', fontWeight: 'var(--fw-medium)' }}>
                          {value}
                        </strong>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 'var(--sp-5)', padding: 'var(--sp-4)', borderRadius: 'var(--r-md)', backgroundColor: 'var(--ns-surface-2)', borderLeft: '3px solid var(--ns-n300)' }}>
                  <p style={{ margin: 0, color: 'var(--ns-n700)', lineHeight: 'var(--lh-body)' }}>
                    {content.riskCopy[aq10Score >= 7 ? 'High' : aq10Score >= 4 ? 'Moderate' : 'Low']}
                  </p>
                </div>
              </section>
            )}

            {(validationMessage || error) && (
              <div className="panel" style={{ borderColor: 'var(--ns-risk-high-border)', backgroundColor: 'var(--ns-risk-high-bg)', color: 'var(--ns-risk-high)', fontWeight: 'var(--fw-medium)' }}>
                {validationMessage || error}
              </div>
            )}

            {!(step === REVIEW_STEP && loading) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--sp-4)' }}>
              <button type="button" onClick={handleBack} className="btn btn-secondary">
                {step === 1 ? 'Change track' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={loading}
                className="btn btn-primary"
              >
                {step === REVIEW_STEP ? `Submit ${content.label.toLowerCase()} screening` : 'Continue'}
              </button>
            </div>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
