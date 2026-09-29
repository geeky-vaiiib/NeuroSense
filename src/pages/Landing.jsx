/**
 * Landing.jsx — NeuroSense public homepage.
 *
 * Design intent: a clinical-grade screening product, not a consumer SaaS.
 * Hero boldness budget: large left-aligned display headline, full weight,
 * no gradient, no color accent in the headline itself.
 * Everything else is quiet and disciplined — supporting, not competing.
 */
import { Link } from 'react-router-dom';

/* ── Shared NeuroLogo — exported for use in Sidebar/Navbar ── */
export function NeuroLogo({ size = 32 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-label="NeuroSense"
    >
      <rect width="32" height="32" rx="6" fill="var(--ns-instrument)" />
      {/* Stylized "N" made of two vertical bars and a diagonal — instrument-style */}
      <line x1="9" y1="8" x2="9" y2="24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="9" y1="8" x2="23" y2="24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="23" y1="8" x2="23" y2="24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── SVG Icons — stroke-based, 20×20 grid ─────────────────── */
const IcoQuestionnaire = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
);
const IcoGaze = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IcoSpeech = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
    <path d="M19 10v2a7 7 0 01-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const IcoXAI = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IcoPrivacy = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IcoThreeTracks = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

/* ── Data constants ───────────────────────────────────────── */
const CAPABILITIES = [
  {
    Icon: IcoQuestionnaire,
    title: 'Validated questionnaires',
    desc: 'AQ-10 and Q-CHAT-10 instruments for adult and child tracks. Scored by a trained ML model, not a cut-off table.',
  },
  {
    Icon: IcoGaze,
    title: 'Eye-gaze analysis',
    desc: 'Webcam-based fixation task captures attention patterns. Results are disclosed with their method and data provenance.',
  },
  {
    Icon: IcoSpeech,
    title: 'Speech signal analysis',
    desc: 'MFCC prosody features extracted from a 20-second recording. Scored as a supplemental signal, not a standalone diagnosis.',
  },
  {
    Icon: IcoXAI,
    title: 'Explainable results',
    desc: 'SHAP and LIME breakdowns show exactly which answers and signals influenced the screening result.',
  },
  {
    Icon: IcoPrivacy,
    title: 'Data transparency',
    desc: 'Each modality discloses whether a trained model or a research heuristic was used — no hidden algorithms.',
  },
  {
    Icon: IcoThreeTracks,
    title: 'Three screening tracks',
    desc: 'Adult self-report, child caregiver report, and toddler Q-CHAT-10 — different models, age-appropriate language.',
  },
];

const PROCESS_STEPS = [
  {
    n: '1',
    title: 'Choose a track',
    desc: 'Select adult, child, or toddler screening. Each track uses a separately trained model and age-appropriate question wording.',
  },
  {
    n: '2',
    title: 'Complete the assessment',
    desc: 'Answer the questionnaire, complete the optional gaze and speech tasks, and capture a facial snapshot. Each step is clearly labeled and skippable.',
  },
  {
    n: '3',
    title: 'Read the report',
    desc: 'A plain-language risk summary with a SHAP breakdown of every contributing factor. Export as a PDF to share with your clinician.',
  },
];

/* ── Nav link ─────────────────────────────────────────────── */
const NAV_LINKS = [
  ['#capabilities', 'Capabilities'],
  ['#how-it-works', 'How it works'],
  ['#who-it-serves', 'Who it serves'],
];

/* ── Inline style helpers (token-consistent) ──────────────── */
const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--ns-surface)',
    fontFamily: 'var(--font-body)',
    display: 'flex',
    flexDirection: 'column',
    color: 'var(--ns-n800)',
  },
  inner: (maxW = 1100) => ({
    maxWidth: maxW,
    margin: '0 auto',
    padding: '0 var(--sp-8)',
    width: '100%',
  }),
};

export default function Landing() {
  return (
    <div style={S.page}>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky', top: 0, zIndex: 'var(--z-sticky)',
          backgroundColor: 'rgba(247,248,250,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: 'var(--border)',
          height: '56px',
          display: 'flex', alignItems: 'center',
        }}
        aria-label="Site navigation"
      >
        <div style={{ ...S.inner(), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo + wordmark */}
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', textDecoration: 'none' }}
            aria-label="NeuroSense home"
          >
            <NeuroLogo size={28} />
            <span style={{ fontSize: 'var(--ts-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--ns-n900)', letterSpacing: 'var(--ls-snug)' }}>
              NeuroSense
            </span>
          </Link>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-8)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-6)' }}>
              {NAV_LINKS.map(([href, label]) => (
                <a
                  key={href} href={href}
                  style={{ fontSize: 'var(--ts-small)', color: 'var(--ns-n600)', fontWeight: 'var(--fw-medium)', textDecoration: 'none' }}
                >
                  {label}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <Link to="/auth" id="nav-signin" className="btn btn-secondary btn-sm">
                Sign in
              </Link>
              <Link to="/auth?mode=register" id="nav-get-started" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero — boldness budget ─────────────────────────── */}
      <section
        style={{ padding: 'var(--sp-24) 0 var(--sp-20)' }}
        aria-labelledby="hero-heading"
      >
        <div style={{ ...S.inner(880) }}>
          {/* System classification — plain, factual */}
          <p style={{
            fontSize: 'var(--ts-small)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--ns-n500)',
            letterSpacing: 'var(--ls-label)',
            marginBottom: 'var(--sp-6)',
            maxWidth: 'none',
          }}>
            Multimodal ASD Screening System — Research grade
          </p>

          {/* H1 — large, left-aligned, single weight. No gradient, no colored word. */}
          <h1
            id="hero-heading"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3rem)',
              fontWeight: 'var(--fw-semibold)',
              lineHeight: 'var(--lh-tight)',
              letterSpacing: '-0.03em',
              color: 'var(--ns-n900)',
              marginBottom: 'var(--sp-6)',
              maxWidth: 'none',
            }}
          >
            Earlier identification.<br />
            Clearer evidence.<br />
            Transparent reasoning.
          </h1>

          <p style={{
            fontSize: '1.0625rem',
            color: 'var(--ns-n600)',
            lineHeight: 'var(--lh-body)',
            marginBottom: 'var(--sp-10)',
            maxWidth: '56ch',
          }}>
            NeuroSense combines validated questionnaires, eye-gaze tracking,
            and speech analysis with SHAP-explained results — so every screening
            decision is grounded in evidence you can read.
          </p>

          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <Link to="/app/screening" id="hero-cta-primary" className="btn btn-primary">
              Begin screening
            </Link>
            <a href="#how-it-works" id="hero-cta-secondary" className="btn btn-secondary">
              See how it works
            </a>
          </div>

          {/* Clinical disclaimer — small, honest */}
          <p style={{
            marginTop: 'var(--sp-8)',
            fontSize: 'var(--ts-caption)',
            color: 'var(--ns-n400)',
            lineHeight: 'var(--lh-body)',
            maxWidth: '52ch',
          }}>
            NeuroSense is a screening aid. Results are not a clinical diagnosis.
            Share any result with a qualified professional before acting on it.
          </p>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────── */}
      <section
        id="capabilities"
        style={{ padding: 'var(--sp-16) 0', borderTop: 'var(--border)' }}
        aria-labelledby="cap-heading"
      >
        <div style={S.inner()}>
          <h2
            id="cap-heading"
            style={{
              fontSize: 'var(--ts-h2)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--ns-n900)',
              letterSpacing: 'var(--ls-snug)',
              marginBottom: 'var(--sp-2)',
            }}
          >
            What the system measures
          </h2>
          <p style={{ color: 'var(--ns-n500)', marginBottom: 'var(--sp-10)', maxWidth: '52ch', fontSize: 'var(--ts-body)' }}>
            Each modality discloses its training data provenance and whether a
            trained model or validated heuristic was used.
          </p>

          {/* 3-column grid — no colored icon backgrounds, no box-shadows */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--sp-1)',
          }}>
            {CAPABILITIES.map(({ Icon, title, desc }) => (
              <div
                key={title}
                style={{
                  padding: 'var(--sp-5)',
                  borderRadius: 'var(--r-md)',
                  border: 'var(--border)',
                  backgroundColor: 'var(--ns-panel)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-3)',
                }}
              >
                <div style={{ color: 'var(--ns-instrument)', lineHeight: 0 }}>
                  <Icon />
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 'var(--ts-body)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--ns-n900)',
                  maxWidth: 'none',
                  lineHeight: 'var(--lh-snug)',
                }}>
                  {title}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 'var(--ts-small)',
                  color: 'var(--ns-n600)',
                  lineHeight: 'var(--lh-body)',
                  maxWidth: 'none',
                }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{ padding: 'var(--sp-16) 0', borderTop: 'var(--border)' }}
        aria-labelledby="how-heading"
      >
        <div style={S.inner(880)}>
          <h2
            id="how-heading"
            style={{
              fontSize: 'var(--ts-h2)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--ns-n900)',
              letterSpacing: 'var(--ls-snug)',
              marginBottom: 'var(--sp-10)',
            }}
          >
            How a screening works
          </h2>

          {/* Steps — numbered because genuinely sequential (wizard flow) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {PROCESS_STEPS.map((step, i) => (
              <div
                key={step.n}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-6)',
                  paddingBottom: i < PROCESS_STEPS.length - 1 ? 'var(--sp-8)' : 0,
                  paddingTop: i > 0 ? 'var(--sp-8)' : 0,
                  borderBottom: i < PROCESS_STEPS.length - 1 ? 'var(--border)' : 'none',
                }}
              >
                {/* Step number — functional sequential marker */}
                <div style={{
                  flexShrink: 0,
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--r-sm)',
                  backgroundColor: 'var(--ns-instrument-dim)',
                  color: 'var(--ns-instrument)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 'var(--ts-small)',
                  fontWeight: 'var(--fw-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {step.n}
                </div>
                <div>
                  <p style={{
                    margin: '0 0 var(--sp-2)',
                    fontSize: 'var(--ts-h3)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--ns-n900)',
                    lineHeight: 'var(--lh-tight)',
                    maxWidth: 'none',
                    letterSpacing: 'var(--ls-snug)',
                  }}>
                    {step.title}
                  </p>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--ts-body)',
                    color: 'var(--ns-n600)',
                    lineHeight: 'var(--lh-body)',
                    maxWidth: '60ch',
                  }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it serves ─────────────────────────────────── */}
      <section
        id="who-it-serves"
        style={{ padding: 'var(--sp-16) 0', borderTop: 'var(--border)' }}
        aria-labelledby="who-heading"
      >
        <div style={S.inner()}>
          <h2
            id="who-heading"
            style={{
              fontSize: 'var(--ts-h2)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--ns-n900)',
              letterSpacing: 'var(--ls-snug)',
              marginBottom: 'var(--sp-10)',
            }}
          >
            Who uses NeuroSense
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--sp-4)',
          }}>
            {[
              {
                title: 'Clinicians and psychologists',
                desc: 'Run structured assessments, generate PDF reports with SHAP explanations, and manage a full caseload from the dashboard.',
              },
              {
                title: 'Parents and caregivers',
                desc: 'Complete a child or toddler screening and receive a plain-language report to share with your pediatrician.',
              },
              {
                title: 'Researchers',
                desc: 'Access case data in a structured format. Each result records the modality used, training provenance, and fusion weight.',
              },
            ].map(({ title, desc }) => (
              <div
                key={title}
                style={{
                  padding: 'var(--sp-5) var(--sp-6)',
                  borderRadius: 'var(--r-md)',
                  backgroundColor: 'var(--ns-surface-2)',
                  borderLeft: '3px solid var(--ns-instrument)',
                }}
              >
                <p style={{
                  margin: '0 0 var(--sp-2)',
                  fontSize: 'var(--ts-body)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--ns-n900)',
                  maxWidth: 'none',
                }}>
                  {title}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 'var(--ts-small)',
                  color: 'var(--ns-n600)',
                  lineHeight: 'var(--lh-body)',
                  maxWidth: 'none',
                }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Call to action ─────────────────────────────────── */}
      <section
        style={{ padding: 'var(--sp-16) 0', borderTop: 'var(--border)' }}
        aria-label="Start a screening"
      >
        <div style={S.inner(880)}>
          <h2 style={{
            fontSize: 'var(--ts-h2)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--ns-n900)',
            letterSpacing: 'var(--ls-snug)',
            marginBottom: 'var(--sp-3)',
          }}>
            Ready to begin?
          </h2>
          <p style={{
            color: 'var(--ns-n600)',
            marginBottom: 'var(--sp-8)',
            fontSize: 'var(--ts-body)',
            maxWidth: '52ch',
          }}>
            Create a free account to start a screening and save your results.
            No subscription required for a first assessment.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <Link to="/auth?mode=register" id="cta-create-account" className="btn btn-primary">
              Create an account
            </Link>
            <Link to="/auth" id="cta-sign-in" className="btn btn-secondary">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: 'var(--border)',
          padding: 'var(--sp-6) 0',
          marginTop: 'auto',
        }}
        aria-label="Footer"
      >
        <div style={{ ...S.inner(), display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <NeuroLogo size={20} />
            <span style={{ fontSize: 'var(--ts-small)', color: 'var(--ns-n500)', fontWeight: 'var(--fw-medium)' }}>NeuroSense</span>
          </div>
          <p style={{
            fontSize: 'var(--ts-caption)',
            color: 'var(--ns-n400)',
            maxWidth: 'none',
            margin: 0,
          }}>
            Research-grade ASD screening aid. Not a diagnostic tool.
            Dept. of ISE, SIT Tumkur.
          </p>
        </div>
      </footer>

    </div>
  );
}
