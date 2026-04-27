/**
 * Screening.jsx — NeuroSense Screening Wizard
 *
 * Steps:
 *   0 — Consent          (fully implemented)
 *   1 — Demographics     (placeholder)
 *   2 — AQ-10            (placeholder)
 *   3 — Review           (placeholder)
 *
 * Neuroinclusive design rules applied to Step 0:
 *  - Plain language: no idioms, one idea per sentence
 *  - No animation or time pressure
 *  - Large tap targets for checkboxes
 *  - Clear disabled/enabled state on Continue button
 */
import React, { useState } from 'react';

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
   Step 1 — Demographics (placeholder)
───────────────────────────────────────────────────────────── */
function StepDemographics({ onNext, onBack }) {
  return (
    <section aria-labelledby="demographics-heading">
      <h2 id="demographics-heading" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-neutral-900)', margin: '0 0 12px' }}>
        About you
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--color-neutral-400)', lineHeight: 1.7 }}>
        Demographics step — coming soon.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button onClick={onBack}  style={secondaryBtn}>← Back</button>
        <button onClick={onNext}  style={primaryBtn}>Continue →</button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 2 — AQ-10 Questionnaire (placeholder)
───────────────────────────────────────────────────────────── */
function StepAQ10({ onNext, onBack }) {
  return (
    <section aria-labelledby="aq10-heading">
      <h2 id="aq10-heading" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-neutral-900)', margin: '0 0 12px' }}>
        AQ-10 Questionnaire
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--color-neutral-400)', lineHeight: 1.7 }}>
        Questionnaire step — coming soon.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button onClick={onBack}  style={secondaryBtn}>← Back</button>
        <button onClick={onNext}  style={primaryBtn}>Continue →</button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Step 3 — Review (placeholder)
───────────────────────────────────────────────────────────── */
function StepReview({ onBack }) {
  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading" style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-neutral-900)', margin: '0 0 12px' }}>
        Review your answers
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--color-neutral-400)', lineHeight: 1.7 }}>
        Review & submit step — coming soon.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button onClick={onBack} style={secondaryBtn}>← Back</button>
        <button style={primaryBtn}>Submit screening</button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared placeholder button styles
───────────────────────────────────────────────────────────── */
const primaryBtn = {
  height: '40px', padding: '0 24px', borderRadius: '10px', border: 'none',
  background: 'linear-gradient(135deg, #7C9A85, #5E7A67)',
  color: '#fff', fontSize: '14px', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 4px 14px rgba(94,122,103,0.25)',
};
const secondaryBtn = {
  height: '40px', padding: '0 20px', borderRadius: '10px',
  border: '1.5px solid var(--color-neutral-200)',
  backgroundColor: 'transparent', color: 'var(--color-neutral-600)',
  fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

/* ─────────────────────────────────────────────────────────────
   Root Screening wizard — step router
───────────────────────────────────────────────────────────── */
export default function Screening() {
  const [step, setStep] = useState(0);

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const STEP_COMPONENTS = [
    <StepConsent     key={0} onNext={goNext} />,
    <StepDemographics key={1} onNext={goNext} onBack={goBack} />,
    <StepAQ10        key={2} onNext={goNext} onBack={goBack} />,
    <StepReview      key={3} onBack={goBack} />,
  ];

  return (
    <main
      id="screening-wizard"
      style={{
        maxWidth: '680px',
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
