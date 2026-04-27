/**
 * Screening.jsx — NeuroSense Screening Wizard
 *
 * Steps:
 *   0 — Consent          (fully implemented)
 *   1 — Demographics     (fully implemented)
 *   2 — AQ-10            (fully implemented)
 *   3 — Review           (placeholder)
 *
 * Neuroinclusive design rules:
 *  - Plain language: no idioms, one idea per sentence
 *  - No animation or time pressure on consent step
 *  - Large tap targets for checkboxes and answer buttons
 *  - Clear disabled/enabled state on Continue button
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScreening } from '../hooks/useScreening';

/* ─────────────────────────────────────────────────────────────
   Step metadata
───────────────────────────────────────────────────────────── */
const STEPS = [
  { id: 0, label: 'Consent' },
  { id: 1, label: 'Demographics' },
  { id: 2, label: 'AQ-10 Questionnaire' },
  { id: 3, label: 'Review' },
];

/* ─────────────────────────────────────────────────────────────
   Consent items — plain language, one idea per sentence
───────────────────────────────────────────────────────────── */
const CONSENT_ITEMS = [
  {
    id: 'consent-guardian',
    label: 'I confirm that I am completing this screening for myself, or I am the parent or legal guardian of the person being screened.',
  },
  {
    id: 'consent-not-diagnosis',
    label: 'I understand that this screening is not a medical diagnosis. A qualified clinician must review the results before any clinical decision is made.',
  },
  {
    id: 'consent-data-processing',
    label: 'I agree that my responses may be processed to generate a risk report. This is done under the Digital Personal Data Protection (DPDP) Act 2023 (India), Section 4 — processing for a specific and lawful purpose.',
  },
  {
    id: 'consent-privacy-read',
    label: 'I have read the privacy notice below. I understand how my data will be used, stored, and deleted.',
  },
];

/* ─────────────────────────────────────────────────────────────
   Step Progress Indicator
───────────────────────────────────────────────────────────── */
function StepIndicator({ current }) {
  return (
    <nav aria-label="Screening wizard progress" style={{ marginBottom: '36px' }}>
      <ol style={{
        display: 'flex',
        alignItems: 'center',
        listStyle: 'none',
        margin: 0, padding: 0,
        gap: 0,
      }}>
        {STEPS.map((step, i) => {
          const done    = current > step.id;
          const active  = current === step.id;
          const future  = current < step.id;

          return (
            <React.Fragment key={step.id}>
              {/* Step circle + label */}
              <li style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}>
                {/* Circle */}
                <div
                  aria-current={active ? 'step' : undefined}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    /* Done: filled sage */
                    ...(done && {
                      backgroundColor: 'var(--color-primary)',
                      border: '2px solid var(--color-primary)',
                    }),
                    /* Active: outlined sage */
                    ...(active && {
                      backgroundColor: '#fff',
                      border: '2px solid var(--color-primary)',
                    }),
                    /* Future: grey */
                    ...(future && {
                      backgroundColor: 'var(--color-neutral-100)',
                      border: '2px solid var(--color-neutral-300)',
                    }),
                  }}
                >
                  {done ? (
                    /* Checkmark */
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#fff" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      color: active
                        ? 'var(--color-primary-dark)'
                        : 'var(--color-neutral-400)',
                    }}>
                      {step.id + 1}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: '11px',
                  fontWeight: active ? 600 : 400,
                  color: active
                    ? 'var(--color-primary-dark)'
                    : done
                    ? 'var(--color-neutral-600)'
                    : 'var(--color-neutral-400)',
                  textAlign: 'center',
                  maxWidth: '80px',
                  lineHeight: 1.3,
                }}>
                  {step.label}
                </span>
              </li>

              {/* Connector line between steps */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: '2px',
                    marginBottom: '24px', /* align with circle centre */
                    backgroundColor: current > step.id
                      ? 'var(--color-primary)'
                      : 'var(--color-neutral-200)',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
   Checkbox row
───────────────────────────────────────────────────────────── */
function ConsentCheckbox({ id, label, checked, onChange }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        cursor: 'pointer',
        padding: '14px 16px',
        borderRadius: '10px',
        border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
        backgroundColor: checked ? 'rgba(124,154,133,0.05)' : 'var(--color-bg-card)',
        /* No transition — neuroinclusive: no animation on this step */
      }}
    >
      {/* Custom checkbox */}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '5px',
        flexShrink: 0,
        marginTop: '1px',
        backgroundColor: checked ? 'var(--color-primary)' : '#fff',
        border: `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--color-neutral-300)'}`,
      }}>
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>

      {/* Hidden native checkbox for keyboard + screen-reader support */}
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
        aria-label={label}
      />

      <span style={{
        fontSize: '14px',
        lineHeight: 1.7,
        color: 'var(--color-neutral-700)',
        fontWeight: 400,
      }}>
        {label}
      </span>
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 0 — Consent
───────────────────────────────────────────────────────────── */
function StepConsent({ onNext }) {
  const [checks, setChecks] = useState({
    'consent-guardian':       false,
    'consent-not-diagnosis':  false,
    'consent-data-processing':false,
    'consent-privacy-read':   false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  const toggle = (id) =>
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section aria-labelledby="consent-heading">
      {/* Section heading */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          id="consent-heading"
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--color-neutral-900)',
            margin: '0 0 6px',
            letterSpacing: '-0.015em',
          }}
        >
          Before you begin
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-neutral-500)',
          lineHeight: 1.7,
          margin: 0,
        }}>
          Please read each section below. Tick each box to confirm you have understood it.
          You must tick all four boxes before you can continue.
        </p>
      </div>

      {/* Privacy notice card */}
      <div
        role="region"
        aria-label="Privacy notice"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: '12px',
          padding: '20px 22px',
          marginBottom: '24px',
        }}
      >
        {/* Notice header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <h3 style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-neutral-700)',
            margin: 0,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}>
            Privacy Notice — DPDP Act 2023 (India)
          </h3>
        </div>

        {/* Notice body — plain language, one idea per sentence */}
        <div style={{
          fontSize: '14px',
          lineHeight: 1.7,
          color: 'var(--color-neutral-600)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              Why we collect your data.
            </strong>{' '}
            NeuroSense collects your responses to generate a risk report for neurodevelopmental
            conditions such as ASD and ADHD. This is the only reason we collect your data.
            We do not use your data for advertising.
          </p>

          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              Legal basis.
            </strong>{' '}
            We process your personal data under the Digital Personal Data Protection (DPDP)
            Act 2023 (India), Section 4. This means we only process data that you have
            given us permission to process.
          </p>

          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              What data we collect.
            </strong>{' '}
            We collect your questionnaire answers, your age range, and your gender (if you
            choose to share it). We do not collect your name unless you choose to enter it.
          </p>

          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              Who sees your data.
            </strong>{' '}
            Your report is only shared with the clinician you choose. No one else can see
            your data without your permission.
          </p>

          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              How long we keep your data.
            </strong>{' '}
            We keep your data for as long as your clinician needs it for your care.
            You can ask us to delete your data at any time by contacting{' '}
            <a
              href="mailto:privacy@neurosense.health"
              style={{ color: 'var(--color-primary-dark)', fontWeight: 500 }}
            >
              privacy@neurosense.health
            </a>.
          </p>

          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              Your rights.
            </strong>{' '}
            Under the DPDP Act 2023, you have the right to access your data, correct it,
            and ask for it to be deleted. You can withdraw your consent at any time.
            Withdrawing consent will not affect any care you have already received.
          </p>

          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--color-neutral-800)', fontWeight: 600 }}>
              This is not a diagnosis.
            </strong>{' '}
            This tool produces a risk score, not a clinical diagnosis. A qualified
            clinician must review your results before any decision is made about your care.
          </p>
        </div>
      </div>

      {/* Checkboxes */}
      <fieldset
        style={{ border: 'none', margin: 0, padding: 0 }}
        aria-describedby="consent-instruction"
      >
        <legend
          id="consent-instruction"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-neutral-600)',
            marginBottom: '12px',
            display: 'block',
          }}
        >
          Tick each box to confirm you agree:
        </legend>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CONSENT_ITEMS.map((item) => (
            <ConsentCheckbox
              key={item.id}
              id={item.id}
              label={item.label}
              checked={checks[item.id]}
              onChange={() => toggle(item.id)}
            />
          ))}
        </div>
      </fieldset>

      {/* Continue button */}
      <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          id="consent-continue-btn"
          onClick={onNext}
          disabled={!allChecked}
          aria-disabled={!allChecked}
          style={{
            height: '44px',
            padding: '0 32px',
            borderRadius: '10px',
            border: 'none',
            background: allChecked
              ? 'linear-gradient(135deg, #7C9A85, #5E7A67)'
              : 'var(--color-neutral-200)',
            color: allChecked ? '#fff' : 'var(--color-neutral-400)',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
            cursor: allChecked ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            /* No box-shadow on disabled — no visual trickery */
            boxShadow: allChecked ? '0 4px 14px rgba(94,122,103,0.30)' : 'none',
          }}
        >
          Continue
          {allChecked && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          )}
        </button>

        {/* Helper text — shown when not all boxes are ticked */}
        {!allChecked && (
          <p
            role="status"
            aria-live="polite"
            style={{
              fontSize: '13px',
              color: 'var(--color-neutral-400)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Please tick all four boxes above to continue.
          </p>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FormField — reusable labelled field wrapper
───────────────────────────────────────────────────────────── */
function FormField({ htmlFor, label, required, optional, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={labelStyle}>
        {label}
        {optional && <span style={{ fontWeight: 400, color: 'var(--color-neutral-400)', marginLeft: '4px' }}>(optional)</span>}
        {required && <span style={{ color: 'var(--color-risk-high)', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FocusInput — input/select with sage focus ring
───────────────────────────────────────────────────────────── */
function FocusInput({ as: Tag = 'input', id, children, ...rest }) {
  const [foc, setFoc] = useState(false);
  return (
    <Tag
      id={id}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
      style={{
        ...fieldBase,
        ...(foc ? fieldFocus : {}),
        ...(Tag === 'select' ? { cursor: 'pointer', appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '32px',
        } : {}),
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 1 — Demographics
───────────────────────────────────────────────────────────── */
function StepDemographics({ demo, setDemo, onNext, onBack }) {
  const set = (key) => (e) => setDemo((p) => ({ ...p, [key]: e.target.value }));
  const canContinue = demo.age !== '' && demo.gender !== '';

  return (
    <section aria-labelledby="demographics-heading">
      <div style={{ marginBottom: '24px' }}>
        <h2 id="demographics-heading" style={{
          fontSize: '1.125rem', fontWeight: 600,
          color: 'var(--color-neutral-900)', margin: '0 0 6px',
          letterSpacing: '-0.015em',
        }}>
          About you
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-neutral-500)', lineHeight: 1.7, margin: 0 }}>
          This information helps us generate a more accurate screening report.
          Only Age and Gender are required.
        </p>
      </div>

      {/* 2-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '18px 20px',
      }}>
        {/* Full Name (optional) */}
        <FormField htmlFor="demo-name" label="Full Name" optional>
          <FocusInput id="demo-name" placeholder="e.g. Jordan A." value={demo.name} onChange={set('name')} />
        </FormField>

        {/* Age (required) */}
        <FormField htmlFor="demo-age" label="Age" required>
          <FocusInput id="demo-age" type="number" min="1" max="100" placeholder="e.g. 28" value={demo.age} onChange={set('age')} />
        </FormField>

        {/* Gender (required) */}
        <FormField htmlFor="demo-gender" label="Gender" required>
          <FocusInput as="select" id="demo-gender" value={demo.gender} onChange={set('gender')}>
            <option value="" disabled>Select…</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </FocusInput>
        </FormField>

        {/* Ethnicity */}
        <FormField htmlFor="demo-ethnicity" label="Ethnicity" optional>
          <FocusInput as="select" id="demo-ethnicity" value={demo.ethnicity} onChange={set('ethnicity')}>
            <option value="" disabled>Select…</option>
            <option value="South Asian">South Asian</option>
            <option value="East Asian">East Asian</option>
            <option value="White-Caucasian">White / Caucasian</option>
            <option value="Black-African">Black / African</option>
            <option value="Mixed">Mixed</option>
            <option value="Other">Other / Prefer not to say</option>
          </FocusInput>
        </FormField>

        {/* Jaundice at birth */}
        <FormField htmlFor="demo-jaundice" label="Jaundice at birth" optional>
          <FocusInput as="select" id="demo-jaundice" value={demo.jaundice} onChange={set('jaundice')}>
            <option value="" disabled>Select…</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </FocusInput>
        </FormField>

        {/* Family history of ASD */}
        <FormField htmlFor="demo-familyAsd" label="Family history of ASD" optional>
          <FocusInput as="select" id="demo-familyAsd" value={demo.familyAsd} onChange={set('familyAsd')}>
            <option value="" disabled>Select…</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </FocusInput>
        </FormField>
      </div>

      {/* Nav buttons */}
      <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} style={secondaryBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <button
          id="demo-continue-btn"
          onClick={onNext}
          disabled={!canContinue}
          style={{
            ...primaryBtn,
            background: canContinue ? primaryBtn.background : 'var(--color-neutral-200)',
            color: canContinue ? '#fff' : 'var(--color-neutral-400)',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            boxShadow: canContinue ? primaryBtn.boxShadow : 'none',
          }}
        >
          Continue
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        {!canContinue && (
          <p role="status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--color-neutral-400)', margin: 0 }}>
            Age and Gender are required.
          </p>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 2 — AQ-10 Questionnaire
───────────────────────────────────────────────────────────── */
function AQ10Card({ q, selectedAnswer, onSelect }) {
  const answered = selectedAnswer != null;
  return (
    <div
      id={`aq10-card-${q.id}`}
      style={{
        border: `1.5px solid ${answered ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
        borderRadius: '12px',
        backgroundColor: answered ? 'rgba(124,154,133,0.03)' : 'var(--color-bg-card)',
        padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: '14px',
        transition: 'border-color 200ms',
      }}
    >
      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 600,
          color: answered ? 'var(--color-primary-dark)' : 'var(--color-neutral-400)',
          flexShrink: 0,
          marginTop: '1px',
        }}>
          {q.id}
        </span>
        <span style={{
          fontSize: '14px',
          lineHeight: 1.7,
          color: 'var(--color-neutral-800)',
          fontWeight: 400,
        }}>
          {q.text}
        </span>
      </div>

      {/* Answer buttons row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {ANSWER_OPTIONS.map((opt) => {
          const isSelected = selectedAnswer === opt;
          return (
            <button
              key={opt}
              aria-pressed={isSelected}
              onClick={() => onSelect(q.id, opt)}
              style={{
                height: '38px',
                borderRadius: '8px',
                border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
                backgroundColor: isSelected ? 'var(--color-primary)' : '#fff',
                color: isSelected ? '#fff' : 'var(--color-neutral-600)',
                fontSize: '12px',
                fontWeight: isSelected ? 600 : 400,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all 150ms',
                padding: '0 6px',
                lineHeight: 1.2,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepAQ10({ answers, setAnswers, onNext, onBack }) {
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === AQ10_QUESTIONS.length;

  const handleSelect = (qId, opt) => {
    setAnswers((prev) => ({ ...prev, [qId]: opt }));
  };

  return (
    <section aria-labelledby="aq10-heading">
      <div style={{ marginBottom: '24px' }}>
        <h2 id="aq10-heading" style={{
          fontSize: '1.125rem', fontWeight: 600,
          color: 'var(--color-neutral-900)', margin: '0 0 6px',
          letterSpacing: '-0.015em',
        }}>
          AQ-10 Screening Questionnaire
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-neutral-500)', lineHeight: 1.7, margin: 0 }}>
          For each statement, select the option that best describes you.
          There are no right or wrong answers. Take as long as you need.
        </p>
      </div>

      {/* Question cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {AQ10_QUESTIONS.map((q) => (
          <AQ10Card
            key={q.id}
            q={q}
            selectedAnswer={answers[q.id] ?? null}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Nav buttons */}
      <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} style={secondaryBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <button
          id="aq10-continue-btn"
          onClick={onNext}
          disabled={!allAnswered}
          style={{
            ...primaryBtn,
            background: allAnswered ? primaryBtn.background : 'var(--color-neutral-200)',
            color: allAnswered ? '#fff' : 'var(--color-neutral-400)',
            cursor: allAnswered ? 'pointer' : 'not-allowed',
            boxShadow: allAnswered ? primaryBtn.boxShadow : 'none',
          }}
        >
          Continue
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            opacity: 0.85,
          }}>
            ({answeredCount}/{AQ10_QUESTIONS.length} answered)
          </span>
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   AQ-10 scoring helper
───────────────────────────────────────────────────────────── */
function computeAQ10Score(answers) {
  let score = 0;
  AQ10_QUESTIONS.forEach((q) => {
    const a = answers[q.id];
    if (!a) return;
    const isAgree = a === 'Definitely agree' || a === 'Slightly agree';
    if (q.asdTrait && isAgree) score += 1;       // trait question: agree = 1
    if (!q.asdTrait && !isAgree) score += 1;      // non-trait question: disagree = 1
  });
  return score;
}

/* ─────────────────────────────────────────────────────────────
   SummaryRow — used in the review grid
───────────────────────────────────────────────────────────── */
function SummaryRow({ label, value, mono }) {
  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: 'var(--color-bg)',
      borderRadius: '8px',
      border: '1px solid var(--color-neutral-100)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-neutral-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--color-neutral-800)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 3 — Review & Submit
───────────────────────────────────────────────────────────── */
function StepReview({ demo, answers, onBack }) {
  const navigate = useNavigate();
  const { submit, loading, error } = useScreening();
  const aq10Score = computeAQ10Score(answers);

  const handleSubmit = async () => {
    try {
      const result = await submit({
        demo,
        answers,
        aq10Score,
      });
      navigate(`/app/results/${result.caseId}`);
    } catch {
      /* error state is set by the hook */
    }
  };

  return (
    <section aria-labelledby="review-heading">
      <div style={{ marginBottom: '24px' }}>
        <h2 id="review-heading" style={{
          fontSize: '1.125rem', fontWeight: 600,
          color: 'var(--color-neutral-900)', margin: '0 0 6px',
          letterSpacing: '-0.015em',
        }}>
          Review your answers
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-neutral-500)', lineHeight: 1.7, margin: 0 }}>
          Please check the summary below before submitting.
        </p>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div
        role="alert"
        style={{
          padding: '16px 18px',
          borderRadius: '10px',
          backgroundColor: 'var(--color-risk-moderate-bg)',
          border: '1px solid var(--color-risk-moderate-border)',
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          marginBottom: '24px',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-risk-moderate)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, color: 'var(--color-neutral-700)' }}>
          <strong style={{ fontWeight: 600 }}>This AI screening tool is not a clinical diagnosis.</strong>{' '}
          Results must be reviewed by a qualified professional before any intervention is planned.
        </p>
      </div>

      {/* ── Summary grid ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
        marginBottom: '24px',
      }}>
        <SummaryRow label="Age" value={demo.age} mono />
        <SummaryRow label="Gender" value={demo.gender} />
        <SummaryRow label="Family History of ASD" value={demo.familyAsd || 'Not provided'} />
        <SummaryRow label="Neonatal Jaundice" value={demo.jaundice || 'Not provided'} />
        <SummaryRow label="AQ-10 Score" value={`${aq10Score} / 10`} mono />
        <SummaryRow label="Modalities" value="Questionnaire + 3 pending" />
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          backgroundColor: 'var(--color-risk-high-bg)',
          border: '1px solid var(--color-risk-high-border)',
          fontSize: '13px', color: 'var(--color-risk-high)',
        }}>
          {error}
        </div>
      )}

      {/* ── Buttons ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} disabled={loading} style={{
          ...secondaryBtn,
          opacity: loading ? 0.5 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <button
          id="submit-screening-btn"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            ...primaryBtn,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? (
            <>
              {/* Simple CSS spinner */}
              <span style={{
                display: 'inline-block', width: '14px', height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 600ms linear infinite',
              }} />
              Processing…
            </>
          ) : (
            <>
              Submit Screening
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared button styles
───────────────────────────────────────────────────────────── */
const primaryBtn = {
  height: '42px', padding: '0 24px', borderRadius: '10px', border: 'none',
  background: 'linear-gradient(135deg, #7C9A85, #5E7A67)',
  color: '#fff', fontSize: '14px', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 4px 14px rgba(94,122,103,0.25)',
  display: 'flex', alignItems: 'center', gap: '8px',
};
const secondaryBtn = {
  height: '42px', padding: '0 20px', borderRadius: '10px',
  border: '1.5px solid var(--color-neutral-200)',
  backgroundColor: 'transparent', color: 'var(--color-neutral-600)',
  fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: '6px',
};

/* ─────────────────────────────────────────────────────────────
   AQ-10 questions — per Allison et al. (2012)
───────────────────────────────────────────────────────────── */
const AQ10_QUESTIONS = [
  { id: 'A1',  text: 'I often notice small sounds when others do not.',                              asdTrait: true  },
  { id: 'A2',  text: 'I usually concentrate more on the whole picture, rather than small details.',   asdTrait: false },
  { id: 'A3',  text: 'I find it easy to do more than one thing at once.',                             asdTrait: false },
  { id: 'A4',  text: 'If there is an interruption, I can switch back to what I was doing quickly.',   asdTrait: false },
  { id: 'A5',  text: 'I find it easy to read between the lines when someone is talking to me.',       asdTrait: false },
  { id: 'A6',  text: 'I know how to tell if someone listening to me is getting bored.',               asdTrait: false },
  { id: 'A7',  text: 'When reading a story, I find it difficult to work out the characters\' intentions.', asdTrait: true },
  { id: 'A8',  text: 'I like to collect information about categories of things.',                     asdTrait: true  },
  { id: 'A9',  text: 'I find it easy to work out what someone is thinking just by looking at their face.', asdTrait: false },
  { id: 'A10', text: 'I find it difficult to work out people\'s intentions.',                         asdTrait: true  },
];

const ANSWER_OPTIONS = [
  'Definitely agree',
  'Slightly agree',
  'Slightly disagree',
  'Definitely disagree',
];

/* ─────────────────────────────────────────────────────────────
   Shared field styles
───────────────────────────────────────────────────────────── */
const fieldBase = {
  width: '100%',
  height: '42px',
  padding: '10px 14px',
  border: '1px solid var(--color-secondary-light)',
  borderRadius: '8px',
  backgroundColor: '#fff',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  color: 'var(--color-neutral-800)',
  outline: 'none',
  boxSizing: 'border-box',
};
const fieldFocus = {
  borderColor: 'var(--color-primary)',
  boxShadow: '0 0 0 3px rgba(124,154,133,0.12)',
};
const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-neutral-700)',
  marginBottom: '6px',
};


/* ─────────────────────────────────────────────────────────────
   Default demographics state
───────────────────────────────────────────────────────────── */
const DEMO_INIT = {
  name: '',
  age: '',
  gender: '',
  ethnicity: '',
  jaundice: '',
  familyAsd: '',
};

/* ─────────────────────────────────────────────────────────────
   Root Screening wizard — step router
   State is lifted here so navigating Back preserves all data.
───────────────────────────────────────────────────────────── */
export default function Screening() {
  const [step, setStep]       = useState(0);
  const [demo, setDemo]       = useState(DEMO_INIT);
  const [answers, setAnswers] = useState({});  /* keyed A1–A10 */

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const STEP_COMPONENTS = [
    <StepConsent      key={0} onNext={goNext} />,
    <StepDemographics key={1} demo={demo} setDemo={setDemo} onNext={goNext} onBack={goBack} />,
    <StepAQ10         key={2} answers={answers} setAnswers={setAnswers} onNext={goNext} onBack={goBack} />,
    <StepReview       key={3} demo={demo} answers={answers} onBack={goBack} />,
  ];

  return (
    <main
      id="screening-wizard"
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Card wrapper */}
      <div style={{
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: '16px',
        padding: '32px 36px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {STEP_COMPONENTS[step]}
      </div>
    </main>
  );
}
