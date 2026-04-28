import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryBadge from '../components/CategoryBadge';
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

const STEP_LABELS = ['Track', 'Consent', 'Profile', 'Questions', 'Review'];

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

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '980px',
  },
  hero: (content) => ({
    background: `linear-gradient(135deg, ${content.accentSoft}, rgba(255,255,255,0.92))`,
    border: `1px solid ${content.accentBorder}`,
    borderRadius: '24px',
    padding: '28px',
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '20px',
    alignItems: 'start',
  }),
  sectionCard: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: 'var(--shadow-xs)',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--color-neutral-500)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: '#fff',
    color: 'var(--color-neutral-800)',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-body)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  button: {
    minHeight: '44px',
    padding: '0 20px',
    borderRadius: '12px',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: '#fff',
    color: 'var(--color-neutral-700)',
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
  },
  primaryButton: (content, disabled) => ({
    minHeight: '46px',
    padding: '0 20px',
    borderRadius: '12px',
    border: 'none',
    background: disabled
      ? 'var(--color-neutral-200)'
      : `linear-gradient(135deg, ${content.accent}, var(--color-primary-dark))`,
    color: disabled ? 'var(--color-neutral-500)' : '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: 'var(--font-body)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 10px 24px rgba(26, 26, 24, 0.10)',
  }),
};

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {STEP_LABELS.map((label, index) => {
        const active = current === index;
        const completed = current > index;
        return (
          <div
            key={label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '999px',
              border: `1px solid ${
                active || completed ? 'var(--color-primary)' : 'var(--color-neutral-200)'
              }`,
              backgroundColor:
                active || completed ? 'var(--color-primary-muted)' : 'var(--color-bg-card)',
              color:
                active || completed
                  ? 'var(--color-primary-dark)'
                  : 'var(--color-neutral-500)',
              fontSize: '0.8rem',
              fontWeight: active ? 700 : 500,
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: completed ? 'var(--color-primary)' : '#fff',
                color: completed ? '#fff' : 'inherit',
                border: `1px solid ${
                  active || completed ? 'var(--color-primary)' : 'var(--color-neutral-300)'
                }`,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
              }}
            >
              {completed ? '✓' : index + 1}
            </span>
            {label}
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
      style={{
        textAlign: 'left',
        padding: '22px',
        borderRadius: '20px',
        border: `1px solid ${active ? content.accent : 'var(--color-neutral-200)'}`,
        background: active
          ? `linear-gradient(135deg, ${content.accentSoft}, rgba(255,255,255,0.96))`
          : 'var(--color-bg-card)',
        boxShadow: active ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <CategoryBadge category={id} size="lg" />
      <div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: '1.1rem',
            color: 'var(--color-neutral-900)',
          }}
        >
          {content.entryTitle}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.92rem',
            lineHeight: 1.6,
            color: 'var(--color-neutral-600)',
          }}
        >
          {content.entryDescription}
        </p>
      </div>
      <div
        style={{
          paddingTop: '8px',
          borderTop: '1px solid var(--color-neutral-100)',
          fontSize: '0.82rem',
          color: content.accent,
          fontWeight: 700,
        }}
      >
        {content.trackSummary}
      </div>
    </button>
  );
}

function FormField({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function QuestionBlock({ question, value, onChange, accent }) {
  return (
    <div
      style={{
        padding: '18px',
        borderRadius: '18px',
        border: '1px solid var(--color-neutral-200)',
        backgroundColor: 'var(--color-bg-card)',
      }}
    >
      <p
        style={{
          margin: '0 0 14px',
          fontWeight: 600,
          color: 'var(--color-neutral-800)',
          lineHeight: 1.55,
        }}
      >
        {question.prompt}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {ANSWER_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(question.id, option)}
              style={{
                minHeight: '42px',
                padding: '0 12px',
                borderRadius: '12px',
                border: `1px solid ${active ? accent : 'var(--color-neutral-200)'}`,
                backgroundColor: active ? 'rgba(124, 154, 133, 0.10)' : '#fff',
                color: active ? 'var(--color-neutral-900)' : 'var(--color-neutral-600)',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
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

  const [step, setStep] = useState(
    routeCategory && CATEGORY_CONTENT[routeCategory] ? 1 : 0
  );
  const [consents, setConsents] = useState(BASE_CONSENTS);
  const [demo, setDemo] = useState(BASE_DEMO);
  const [answers, setAnswers] = useState({});
  const [validationMessage, setValidationMessage] = useState('');

  const category =
    routeCategory && CATEGORY_CONTENT[routeCategory] ? routeCategory : '';
  const content = category ? getCategoryContent(category) : null;
  const questions = category ? QUESTION_BANK[category] : [];
  const aq10Score = useMemo(() => buildAq10Score(answers, category || 'adult'), [answers, category]);
  const ageCheck = useMemo(
    () => validateCategoryAge(category, Number(demo.age)),
    [category, demo.age]
  );

  function selectCategory(nextCategory) {
    setStep(1);
    setValidationMessage('');
    setConsents(BASE_CONSENTS);
    setDemo((current) => ({
      ...current,
      respondentRelationship:
        CATEGORY_CONTENT[nextCategory].demographics.respondentRelationshipValue,
    }));
    navigate(`/app/screening/${nextCategory}`, { replace: true });
  }

  function updateDemo(key, value) {
    setDemo((current) => ({ ...current, [key]: value }));
    if (key === 'age' || key === 'respondentRelationship') {
      setValidationMessage('');
    }
  }

  function updateConsent(index, checked) {
    setConsents((current) => current.map((value, item) => (item === index ? checked : value)));
  }

  function updateAnswer(questionId, answer) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  const allConsentsAccepted = consents.every(Boolean);
  const demographicsReady =
    Number(demo.age) >= 0 &&
    demo.gender &&
    (category === 'adult' || Boolean(demo.respondentRelationship));
  const questionnaireReady = questions.every((question) => answers[question.id]);
  const summaryRows = [
    ['Category', content?.label],
    ['Screening tool', content?.screeningTool],
    ['AQ-10 score', `${aq10Score}/10`],
    ['Submitted for', demo.subjectName || 'No name provided'],
    [
      category === 'adult' ? 'Completion mode' : 'Respondent relationship',
      category === 'adult'
        ? content?.trackSummary
        : demo.respondentRelationship || 'Not provided',
    ],
    ['Age', demo.age || 'Not provided'],
    ['Gender', demo.gender || 'Not provided'],
  ];

  async function handlePrimaryAction() {
    if (!category) return;

    if (step === 1) {
      if (!allConsentsAccepted) {
        setValidationMessage('Please confirm all consent items before continuing.');
        return;
      }
      setValidationMessage('');
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!demographicsReady) {
        setValidationMessage('Please complete the required demographic fields.');
        return;
      }
      if (!ageCheck.valid) {
        setValidationMessage(ageCheck.message);
        return;
      }
      setValidationMessage('');
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!questionnaireReady) {
        setValidationMessage('Please answer all ten questionnaire items before continuing.');
        return;
      }
      setValidationMessage('');
      setStep(4);
      return;
    }

    if (step === 4) {
      try {
        const payload = {
          category,
          demo: {
            ...demo,
            respondentRelationship:
              demo.respondentRelationship ||
              content.demographics.respondentRelationshipValue,
            age: Number(demo.age),
          },
          answers,
          aq10Score,
        };
        const result = await submit(payload);
        navigate(`/app/results/${result.caseId}`);
      } catch {
        // The hook surfaces the error message for the UI.
      }
    }
  }

  function handleBack() {
    if (step <= 1) {
      setStep(0);
      navigate('/app/screening', { replace: true });
      return;
    }
    setValidationMessage('');
    setStep((current) => current - 1);
  }

  return (
    <main id="screening-page" style={styles.page}>
      <div style={styles.sectionCard}>
        <StepIndicator current={step} />
      </div>

      {step === 0 && (
        <section style={styles.sectionCard}>
          <div style={{ marginBottom: '18px' }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-primary)',
              }}
            >
              Choose a screening track
            </p>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: '1.7rem',
                color: 'var(--color-neutral-900)',
              }}
            >
              Start with the right age-based experience
            </h1>
            <p
              style={{
                margin: 0,
                color: 'var(--color-neutral-600)',
                lineHeight: 1.7,
                maxWidth: '700px',
              }}
            >
              NeuroSense routes every screening through an age-based track — adult, child, or
              toddler. Each track has its own language, validation rules, model pipeline, and
              results interpretation.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {CATEGORY_ORDER.map((item) => (
              <TrackCard
                key={item}
                id={item}
                active={category === item}
                onSelect={selectCategory}
              />
            ))}
          </div>
        </section>
      )}

      {content && step > 0 && (
        <>
          <section style={styles.hero(content)}>
            <div>
              <CategoryBadge category={category} size="lg" />
              <h1
                style={{
                  margin: '14px 0 8px',
                  fontSize: '1.85rem',
                  color: 'var(--color-neutral-900)',
                }}
              >
                {content.introTitle}
              </h1>
              <p
                style={{
                  margin: 0,
                  color: 'var(--color-neutral-700)',
                  lineHeight: 1.7,
                }}
              >
                {content.introDescription}
              </p>
            </div>
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '18px',
                padding: '18px',
                border: '1px solid rgba(255,255,255,0.7)',
              }}
            >
              <p style={styles.label}>Track details</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <strong style={{ color: 'var(--color-neutral-800)' }}>Primary tool:</strong>{' '}
                  <span style={{ color: 'var(--color-neutral-600)' }}>{content.screeningTool}</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--color-neutral-800)' }}>Respondent mode:</strong>{' '}
                  <span style={{ color: 'var(--color-neutral-600)' }}>{content.trackSummary}</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--color-neutral-800)' }}>Model pipeline:</strong>{' '}
                  <span style={{ color: 'var(--color-neutral-600)' }}>{category}_pipeline</span>
                </div>
              </div>
            </div>
          </section>

          {step === 1 && (
            <section style={styles.sectionCard}>
              <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
                {content.consentTitle}
              </h2>
              <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                {content.consentDescription}
              </p>
              <div style={{ display: 'grid', gap: '12px', marginTop: '18px' }}>
                {content.consentItems.map((item, index) => (
                  <label
                    key={item}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      border: `1px solid ${
                        consents[index] ? content.accent : 'var(--color-neutral-200)'
                      }`,
                      backgroundColor: consents[index]
                        ? content.accentSoft
                        : 'var(--color-bg-card)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={consents[index]}
                      onChange={(event) => updateConsent(index, event.target.checked)}
                      style={{ marginTop: '3px' }}
                    />
                    <span style={{ color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section style={styles.sectionCard}>
              <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
                Demographics and respondent context
              </h2>
              <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                {category === 'adult'
                  ? 'These details stay attached to the adult result, case record, and explanation.'
                  : category === 'toddler'
                    ? 'These details stay attached to the toddler result, case record, and caregiver context.'
                    : 'These details stay attached to the child result, case record, and caregiver context.'}
              </p>
              <div style={styles.grid}>
                <FormField label={content.demographics.subjectNameLabel}>
                  <input
                    value={demo.subjectName}
                    onChange={(event) => updateDemo('subjectName', event.target.value)}
                    style={styles.input}
                  />
                </FormField>
                <FormField label={content.demographics.respondentNameLabel}>
                  <input
                    value={demo.respondentName}
                    onChange={(event) => updateDemo('respondentName', event.target.value)}
                    style={styles.input}
                  />
                </FormField>
                <FormField label={content.demographics.respondentRelationshipLabel}>
                  <input
                    value={demo.respondentRelationship}
                    disabled={category === 'adult'}
                    onChange={(event) =>
                      updateDemo('respondentRelationship', event.target.value)
                    }
                    style={{
                      ...styles.input,
                      backgroundColor:
                        category === 'adult' ? 'var(--color-neutral-100)' : '#fff',
                    }}
                  />
                </FormField>
                <FormField label={content.demographics.ageLabel}>
                  <input
                    type="number"
                    min={category === 'toddler' ? '0' : '1'}
                    max={category === 'toddler' ? '4' : '99'}
                    value={demo.age}
                    onChange={(event) => updateDemo('age', event.target.value)}
                    style={styles.input}
                  />
                </FormField>
                <FormField label={content.demographics.genderLabel}>
                  <select
                    value={demo.gender}
                    onChange={(event) => updateDemo('gender', event.target.value)}
                    style={styles.input}
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={content.demographics.ethnicityLabel}>
                  <select
                    value={demo.ethnicity}
                    onChange={(event) => updateDemo('ethnicity', event.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select one</option>
                    {ETHNICITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={content.demographics.jaundiceLabel}>
                  <select
                    value={demo.jaundice}
                    onChange={(event) => updateDemo('jaundice', event.target.value)}
                    style={styles.input}
                  >
                    {YES_NO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label={content.demographics.familyAsdLabel}>
                  <select
                    value={demo.familyAsd}
                    onChange={(event) => updateDemo('familyAsd', event.target.value)}
                    style={styles.input}
                  >
                    {YES_NO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              {!ageCheck.valid && (
                <p
                  style={{
                    marginTop: '16px',
                    color: 'var(--color-risk-high)',
                    fontWeight: 600,
                  }}
                >
                  {ageCheck.message}
                </p>
              )}
            </section>
          )}

          {step === 3 && (
            <section style={styles.sectionCard}>
              <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
                {content.questionnaireTitle}
              </h2>
              <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                {content.questionnaireDescription}
              </p>
              <div style={{ display: 'grid', gap: '14px', marginTop: '18px' }}>
                {questions.map((question) => (
                  <QuestionBlock
                    key={question.id}
                    question={question}
                    value={answers[question.id]}
                    onChange={updateAnswer}
                    accent={content.accent}
                  />
                ))}
              </div>
            </section>
          )}

          {step === 4 && (
            <section style={styles.sectionCard}>
              <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>
                {content.reviewTitle}
              </h2>
              <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                {content.reviewDescription}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '18px' }}>
                {summaryRows.map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      border: '1px solid var(--color-neutral-200)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  >
                    <p style={{ ...styles.label, marginBottom: '6px' }}>{label}</p>
                    <strong style={{ color: 'var(--color-neutral-900)' }}>{value}</strong>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '18px',
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: content.accentSoft,
                  border: `1px solid ${content.accentBorder}`,
                }}
              >
                <p style={{ margin: 0, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
                  {content.riskCopy[aq10Score >= 7 ? 'High' : aq10Score >= 4 ? 'Moderate' : 'Low']}
                </p>
              </div>
            </section>
          )}

          {(validationMessage || error) && (
            <div
              style={{
                ...styles.sectionCard,
                borderColor: 'var(--color-risk-high-border)',
                backgroundColor: 'var(--color-risk-high-muted)',
                color: 'var(--color-risk-high)',
              }}
            >
              {validationMessage || error}
            </div>
          )}

          <div style={styles.buttonRow}>
            <button type="button" onClick={handleBack} style={styles.button}>
              {step === 1 ? 'Change track' : 'Back'}
            </button>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={loading}
              style={styles.primaryButton(content, loading)}
            >
              {step === 4
                ? loading
                  ? 'Submitting…'
                  : `Submit ${content.label.toLowerCase()} screening`
                : 'Continue'}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
