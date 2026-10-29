/**
 * Toddler (18-24 months) Q-CHAT-10 screening: welcome -> age -> instructions -> ten questions -> review -> submit -> results.
 * The browser only collects answers (option letters) and the age in months. The score, the model output and the stored case
 * all come from the server; nothing here computes or fakes a result.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToddlerQuestionFlow from '../components/screening/ToddlerQuestionFlow';
import AnalysisState from '../components/screening/AnalysisState';
import { useScreening } from '../hooks/useScreening';
import { AGE_MAX, AGE_MIN, TODDLER_ITEMS, validateAgeMonths } from '../data/toddler';

const STEPS = ['welcome', 'age', 'instructions', 'questions', 'review'];
const LABELS = { welcome: 'Welcome', age: 'Your child', instructions: 'How to answer', questions: 'Questions', review: 'Review' };
const GENDERS = ['Prefer not to say', 'Female', 'Male'];

export default function ToddlerScreening() {
  const navigate = useNavigate();
  const { submit, loading, error } = useScreening();
  const [step, setStep] = useState('welcome');
  const [agree, setAgree] = useState(false);
  const [ageText, setAgeText] = useState('');
  const [ageTouched, setAgeTouched] = useState(false);
  const [gender, setGender] = useState('Prefer not to say');
  const [childName, setChildName] = useState('');
  const [answers, setAnswers] = useState({});
  const [notice, setNotice] = useState('');
  const [startAt, setStartAt] = useState(undefined);
  const headingRef = useRef(null);
  const age = validateAgeMonths(ageText);

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const missing = TODDLER_ITEMS.filter((q) => !answers[q.id]);

  async function send() {
    if (missing.length) { setNotice(`Please answer question${missing.length > 1 ? 's' : ''} ${missing.map((q) => q.id.slice(1)).join(', ')} before sending.`); return; }
    if (!age.valid) { setStep('age'); setAgeTouched(true); return; }
    setNotice('');
    try {
      const result = await submit({
        category: 'toddler',
        demo: { ageMonths: age.months, gender, subjectName: childName.trim() || undefined },
        answers,
        gazeSkipped: true, gazeSkipReason: 'toddler_questionnaire_only', speechSkipped: true, facialSkipped: true,
      });
      navigate(`/app/results/${result.caseId}`);
    } catch {
      // useScreening exposes the error; nothing is faked and the answers stay on screen so the caregiver can retry.
    }
  }

  const h = (text) => <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em', outline: 'none' }}>{text}</h1>;
  const stepIndex = STEPS.indexOf(step);

  return (
    <main id="toddler-screening" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <nav aria-label="Screening progress" style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--ns-n600)' }}>Step {stepIndex + 1} of {STEPS.length} · {LABELS[step]}</p>
      </nav>

      <section className="ns-card" style={{ padding: 'clamp(20px, 4vw, 36px)' }}>
        {step === 'welcome' && (
          <div>
            <p className="ns-eyebrow">Toddler questionnaire · {AGE_MIN}–{AGE_MAX} months</p>
            {h('Let’s answer a few questions about your child')}
            <p style={{ marginTop: 14, fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--ns-n700)' }}>
              This is a short checklist of ten questions about everyday things your child does. It takes about five minutes.
              There are no right or wrong answers, and you can take your time.
            </p>
            <p style={{ marginTop: 12, fontSize: '1rem', lineHeight: 1.7, color: 'var(--ns-n600)' }}>
              It is a screening tool, not a diagnosis. Only a qualified professional can assess a child.
            </p>
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 22, padding: 16, borderRadius: 14, border: `1.5px solid ${agree ? 'var(--ns-instrument)' : 'var(--ns-n200)'}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--ns-instrument)' }} />
              <span style={{ lineHeight: 1.6 }}>I am this child’s parent or caregiver, and I understand this is a screening questionnaire, not a diagnosis.</span>
            </label>
          </div>
        )}

        {step === 'age' && (
          <div>
            {h('How old is your child?')}
            <p style={{ marginTop: 12, color: 'var(--ns-n600)', lineHeight: 1.6 }}>
              Please enter your child’s age in <strong>months</strong> (for example, 1 year 8 months is 20 months). This questionnaire is for children aged {AGE_MIN} to {AGE_MAX} months.
            </p>
            <div style={{ display: 'grid', gap: 18, marginTop: 22, maxWidth: 360 }}>
              <label style={{ display: 'block' }}>
                <span className="field-label">Age in months (required)</span>
                <input className="field-input" inputMode="numeric" autoComplete="off" value={ageText} aria-invalid={ageTouched && !age.valid}
                  aria-describedby="age-help" onBlur={() => setAgeTouched(true)} onChange={(e) => { setAgeText(e.target.value); setNotice(''); }} />
              </label>
              <p id="age-help" role={ageTouched && !age.valid ? 'alert' : undefined} style={{ margin: 0, fontSize: '0.92rem', color: ageTouched && !age.valid ? 'var(--ns-risk-high-text)' : 'var(--ns-n500)' }}>
                {ageTouched && !age.valid ? age.message : `A whole number from ${AGE_MIN} to ${AGE_MAX}.`}
              </p>
              <label style={{ display: 'block' }}>
                <span className="field-label">Child’s name or nickname (optional)</span>
                <input className="field-input" value={childName} maxLength={80} onChange={(e) => setChildName(e.target.value)} />
              </label>
              <label style={{ display: 'block' }}>
                <span className="field-label">Child’s sex (optional)</span>
                <select className="field-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {step === 'instructions' && (
          <div>
            {h('How to answer')}
            <ul style={{ marginTop: 16, paddingLeft: 20, display: 'grid', gap: 10, listStyle: 'disc', fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--ns-n700)' }}>
              <li>Choose the answer that best matches what you usually see.</li>
              <li>If you are unsure, pick the closest one. You can go back and change any answer.</li>
              <li>Some questions give an example. The example is only to help; it doesn’t have to match your child exactly.</li>
              <li>Please answer all ten questions. Nothing is sent until you review your answers and choose to send them.</li>
            </ul>
          </div>
        )}

        {step === 'questions' && (
          <ToddlerQuestionFlow key={startAt ?? 'new'} startAt={startAt} items={TODDLER_ITEMS} answers={answers}
            onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} onFinish={() => setStep('review')} onExit={() => setStep('instructions')} />
        )}

        {step === 'review' && loading && <AnalysisState />}

        {step === 'review' && !loading && (
          <div>
            {h('Check your answers')}
            <p style={{ marginTop: 12, color: 'var(--ns-n600)', lineHeight: 1.6 }}>
              Your child is <strong>{age.valid ? `${age.months} months` : 'age not entered'}</strong>. Choose “Change” beside any answer to edit it.
            </p>
            <ol style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 10 }}>
              {TODDLER_ITEMS.map((q, i) => {
                const opt = q.options.find((o) => o.value === answers[q.id]);
                return (
                  <li key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${opt ? 'var(--ns-n200)' : 'var(--ns-risk-high-border)'}` }}>
                    <span><span style={{ color: 'var(--ns-n500)' }}>{i + 1}. </span>{q.text}<br />
                      <strong>{opt ? opt.label : 'Not answered yet'}</strong></span>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Change answer to question ${i + 1}`}
                      onClick={() => { setStartAt(i); setStep('questions'); }}>Change</button>
                  </li>
                );
              })}
            </ol>
            <p role="note" style={{ marginTop: 18, fontSize: '0.92rem', color: 'var(--ns-n600)', lineHeight: 1.6 }}>
              When you send your answers, our server works out the questionnaire score and shows it with a plain explanation. Eye-gaze, speech and face measurements are not part of this questionnaire.
            </p>
          </div>
        )}

        {(notice || error) && (
          <div role="alert" style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'var(--ns-risk-high-bg)', color: 'var(--ns-risk-high-text)', border: '1px solid var(--ns-risk-high-border)' }}>
            {notice || `We couldn’t send your answers: ${error} Your answers are still here — please try again.`}
          </div>
        )}

        {step !== 'questions' && !(step === 'review' && loading) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary"
              onClick={() => { setNotice(''); step === 'welcome' ? navigate('/app/screening') : setStep(STEPS[stepIndex - 1]); }}>Back</button>
            {step === 'welcome' && <button type="button" className="btn btn-primary" disabled={!agree} onClick={() => setStep('age')}>Start</button>}
            {step === 'age' && <button type="button" className="btn btn-primary" onClick={() => { setAgeTouched(true); if (age.valid) setStep('instructions'); }}>Continue</button>}
            {step === 'instructions' && <button type="button" className="btn btn-primary" onClick={() => { setStartAt(undefined); setStep('questions'); }}>Begin the questions</button>}
            {step === 'review' && <button type="button" className="btn btn-primary" onClick={send}>{error ? 'Try again' : 'Send my answers'}</button>}
          </div>
        )}
      </section>
    </main>
  );
}
