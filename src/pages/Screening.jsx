import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
import GazeSession from '../components/GazeSession';
import SpeechSession from '../components/SpeechSession';
import FacialSession from '../components/FacialSession';
import { useScreening } from '../hooks/useScreening';
import {
  ANSWER_OPTIONS,
  CATEGORY_CONTENT,
  CATEGORY_ORDER,
  ETHNICITY_OPTIONS,
  GENDER_OPTIONS,
  QUESTION_BANK,
  YES_NO_OPTIONS,
  buildAq10Score,
  getCategoryContent,
  validateCategoryAge,
} from '../data/screeningContent';

const STEP_LABELS_FULL = ['Track', 'Consent', 'Demographics', 'AQ-10', 'Gaze', 'Speech', 'Facial', 'Review'];
const STEP_LABELS_TODDLER = ['Track', 'Consent', 'Demographics', 'Q-CHAT-10', 'Review'];

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

function StepIndicator({ current, isToddler }) {
  const labels = isToddler ? STEP_LABELS_TODDLER : STEP_LABELS_FULL;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {labels.map((label, index) => {
        const active = current === index;
        const completed = current > index;
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-2)',
              borderRadius: 'var(--r-md)',
              backgroundColor: active ? 'var(--ns-instrument-dim)' : 'transparent',
              color: active ? 'var(--ns-instrument)' : completed ? 'var(--ns-n900)' : 'var(--ns-n500)',
              fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              transition: 'all var(--ease-fast)',
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: completed ? 'var(--ns-instrument)' : active ? 'transparent' : 'var(--ns-surface-2)',
                color: completed ? '#fff' : active ? 'var(--ns-instrument)' : 'var(--ns-n500)',
                border: `1px solid ${completed ? 'var(--ns-instrument)' : active ? 'var(--ns-instrument)' : 'var(--border-color)'}`,
                fontFamily: 'var(--font-data)',
                fontSize: 'var(--ts-caption)',
              }}
            >
              {completed ? '✓' : index + 1}
            </span>
            <span style={{ fontSize: 'var(--ts-small)' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrackCard({ id, active, onSelect }) {
  const content = CATEGORY_CONTENT[id];
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className="panel"
      style={{
        textAlign: 'left',
        padding: 'var(--sp-6)',
        border: `1px solid ${active ? 'var(--ns-instrument)' : 'var(--border-color)'}`,
        boxShadow: active ? '0 0 0 1px var(--ns-instrument)' : 'none',
        backgroundColor: active ? 'var(--ns-instrument-dim)' : 'var(--ns-panel)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)',
        transition: 'all var(--ease-fast)',
      }}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.borderColor = 'var(--ns-n400)';
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
    >
      <CategoryBadge category={id} size="lg" />
      <div>
        <h3 style={{ margin: '0 0 var(--sp-1)', fontSize: 'var(--ts-h3)', color: 'var(--ns-n900)' }}>
          {content.entryTitle}
        </h3>
        <p style={{ margin: 0, fontSize: 'var(--ts-body)', color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)' }}>
          {content.entryDescription}
        </p>
      </div>
      <div style={{ paddingTop: 'var(--sp-3)', borderTop: 'var(--border)', fontSize: 'var(--ts-small)', color: 'var(--ns-instrument)', fontWeight: 'var(--fw-semibold)' }}>
        {content.trackSummary}
      </div>
    </button>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function QuestionBlock({ question, value, onChange }) {
  return (
    <div className="panel" style={{ padding: 'var(--sp-5)' }}>
      <p style={{ margin: '0 0 var(--sp-4)', fontWeight: 'var(--fw-medium)', color: 'var(--ns-n900)', lineHeight: 'var(--lh-snug)' }}>
        {question.prompt}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--sp-2)' }}>
        {ANSWER_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(question.id, option)}
              style={{
                minHeight: '40px',
                padding: '0 var(--sp-3)',
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${active ? 'var(--ns-instrument)' : 'var(--border-color)'}`,
                backgroundColor: active ? 'var(--ns-instrument-dim)' : 'var(--ns-panel)',
                color: active ? 'var(--ns-instrument)' : 'var(--ns-n700)',
                fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                cursor: 'pointer',
                transition: 'all var(--ease-fast)',
              }}
              onMouseOver={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'var(--ns-surface-2)';
              }}
              onMouseOut={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'var(--ns-panel)';
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Screening() {
  const { category: routeCategory } = useParams();
  const navigate = useNavigate();
  const { submit, loading, error } = useScreening();

  const [step, setStep] = useState(routeCategory && CATEGORY_CONTENT[routeCategory] ? 1 : 0);
  const [consents, setConsents] = useState(BASE_CONSENTS);
  const [demo, setDemo] = useState(BASE_DEMO);
  const [answers, setAnswers] = useState({});
  const [gazeData, setGazeData] = useState(null);
  const [gazeSkipped, setGazeSkipped] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcriptHint, setTranscriptHint] = useState('');
  const [speechSkipped, setSpeechSkipped] = useState(false);
  const [facialImage, setFacialImage] = useState(null);
  const [facialSkipped, setFacialSkipped] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const category = routeCategory && CATEGORY_CONTENT[routeCategory] ? routeCategory : '';
  const content = category ? getCategoryContent(category) : null;
  const questions = category ? QUESTION_BANK[category] : [];
  const aq10Score = useMemo(() => buildAq10Score(answers, category || 'adult'), [answers, category]);
  const ageCheck = useMemo(() => validateCategoryAge(category, Number(demo.age)), [category, demo.age]);

  const isToddler = category === 'toddler';
  const hasGaze = !isToddler && (category === 'adult' || category === 'child');
  const GAZE_STEP = 4;
  const SPEECH_STEP = 5;
  const FACIAL_STEP = 6;
  const REVIEW_STEP = isToddler ? 4 : 7;

  function selectCategory(nextCategory) {
    setStep(1);
    setValidationMessage('');
    setConsents(BASE_CONSENTS);
    setDemo((current) => ({
      ...current,
      respondentRelationship: CATEGORY_CONTENT[nextCategory].demographics.respondentRelationshipValue,
    }));
    navigate(`/app/screening/${nextCategory}`, { replace: true });
  }

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
  const demographicsReady = Number(demo.age) >= 0 && demo.gender && (category === 'adult' || Boolean(demo.respondentRelationship));
  const questionnaireReady = questions.every((question) => answers[question.id]);

  const gazeStatusLabel = (() => {
    if (isToddler) return 'N/A — Toddler track';
    if (gazeSkipped) return 'Skipped';
    if (gazeData) return `${gazeData.length} fixation points captured`;
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
    [category === 'adult' ? 'Completion mode' : 'Respondent relationship', category === 'adult' ? content?.trackSummary : demo.respondentRelationship || 'Not provided'],
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
          demo: { ...demo, respondentRelationship: demo.respondentRelationship || content.demographics.respondentRelationshipValue, age: Number(demo.age) },
          answers,
          aq10Score,
          gazePoints: gazeData || [],
          gazeSkipped,
          audioBase64: audioBase64,
          audioMimeType: audioBlob?.type || null,
          transcriptHint: transcriptHint,
          speechSkipped,
          facialImageBase64: facialImage,
          facialSkipped,
        };
        const result = await submit(payload);
        navigate(`/app/results/${result.caseId}`);
      } catch {}
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
    <main id="screening-page" style={{ display: 'flex', gap: 'var(--sp-12)', alignItems: 'flex-start', maxWidth: step === 0 ? '980px' : '960px', margin: step === 0 ? '0 auto' : '0' }}>
      
      {/* Wizard Step Indicator Sidebar */}
      {step > 0 && (
        <aside style={{ width: '200px', flexShrink: 0, position: 'sticky', top: 'calc(var(--navbar-height) + var(--sp-8))' }}>
          <StepIndicator current={step} isToddler={isToddler} />
        </aside>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, maxWidth: step === 0 ? '100%' : '640px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        
        {step === 0 && (
          <section className="panel" style={{ border: 'none', backgroundColor: 'transparent', padding: 0 }}>
            <div style={{ marginBottom: 'var(--sp-6)' }}>
              <h1 style={{ margin: '0 0 var(--sp-2)', fontSize: 'var(--ts-h1)', color: 'var(--ns-n900)' }}>
                Start a screening
              </h1>
              <p style={{ margin: 0, color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)', maxWidth: '60ch' }}>
                NeuroSense routes every screening through an age-based track. Each track has its own 
                validated questions, model pipeline, and diagnostic thresholds.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}>
              {CATEGORY_ORDER.map((item) => (
                <TrackCard key={item} id={item} active={category === item} onSelect={selectCategory} />
              ))}
            </div>
          </section>
        )}

        {content && step > 0 && (
          <div className="wizard-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
            
            {/* Top track summary banner */}
            <section className="panel" style={{ backgroundColor: 'var(--ns-surface-2)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                <CategoryBadge category={category} size="md" />
                <span style={{ fontSize: 'var(--ts-caption)', color: 'var(--ns-n500)', fontFamily: 'var(--font-data)' }}>
                  Model: {category}_pipeline
                </span>
              </div>
              <h1 style={{ margin: '0 0 var(--sp-1)', fontSize: 'var(--ts-h2)', color: 'var(--ns-n900)' }}>
                {content.introTitle}
              </h1>
              <p style={{ margin: 0, color: 'var(--ns-n600)', fontSize: 'var(--ts-small)' }}>
                {content.screeningTool} · {content.trackSummary}
              </p>
            </section>

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
                      disabled={category === 'adult'}
                      onChange={(e) => updateDemo('respondentRelationship', e.target.value)}
                      style={{ backgroundColor: category === 'adult' ? 'var(--ns-surface-2)' : 'var(--ns-panel)' }}
                    />
                  </FormField>
                  <FormField label={content.demographics.ageLabel}>
                    <input className="field-input" type="number" min={category === 'toddler' ? '0' : '1'} max={category === 'toddler' ? '4' : '99'} value={demo.age} onChange={(e) => updateDemo('age', e.target.value)} />
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
              <section>
                <div className="panel" style={{ marginBottom: 'var(--sp-4)', border: 'none', backgroundColor: 'transparent', padding: 0 }}>
                  <h2 style={{ marginTop: 0, color: 'var(--ns-n900)', fontSize: 'var(--ts-h3)' }}>{content.questionnaireTitle}</h2>
                  <p style={{ color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)' }}>{content.questionnaireDescription}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  {questions.map((question) => (
                    <QuestionBlock key={question.id} question={question} value={answers[question.id]} onChange={updateAnswer} />
                  ))}
                </div>
              </section>
            )}

            {hasGaze && step === GAZE_STEP && (
              <GazeSession
                category={category}
                onComplete={(data) => { setGazeData(data); setGazeSkipped(false); setStep(SPEECH_STEP); }}
                onSkip={() => { setGazeData(null); setGazeSkipped(true); setStep(SPEECH_STEP); }}
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

            {step === REVIEW_STEP && (
              <section className="panel">
                <h2 style={{ marginTop: 0, color: 'var(--ns-n900)', fontSize: 'var(--ts-h3)' }}>{content.reviewTitle}</h2>
                <p style={{ color: 'var(--ns-n600)', lineHeight: 'var(--lh-body)', marginBottom: 'var(--sp-5)' }}>{content.reviewDescription}</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-3)' }}>
                  {summaryRows.map(([label, value]) => {
                    const isMultimodal = ['Eye Gaze', 'Speech Sample', 'Facial Expression'].includes(label);
                    const hasCapturedData = isMultimodal && (
                      (label === 'Eye Gaze' && gazeData && !gazeSkipped) ||
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
                {step === REVIEW_STEP ? (loading ? 'Submitting…' : `Submit ${content.label.toLowerCase()} screening`) : 'Continue'}
              </button>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
