/**
 * Landing.jsx
 * Public marketing page — hero, features, stats, how it works, CTA.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── Data ──────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    color: '#7C9A85',
    bg: 'rgba(124,154,133,0.1)',
    title: 'XAI Explanations',
    desc: 'SHAP-powered feature attribution shows exactly which clinical signals drive every risk prediction — no black boxes.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    color: '#C0555A',
    bg: 'rgba(192,85,90,0.08)',
    title: 'Risk Stratification',
    desc: 'Three-tier risk classification — High, Moderate, Low — with confidence scores for prioritised clinical workflows.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: '#5E7A67',
    bg: 'rgba(94,122,103,0.1)',
    title: 'DPDP Act 2023',
    desc: 'Built from ground up to comply with India\'s Digital Personal Data Protection Act — data never leaves your jurisdiction.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
    color: '#B8873A',
    bg: 'rgba(184,135,58,0.08)',
    title: 'Multi-Condition',
    desc: 'Covers ASD, ADHD, Dyslexia, and co-occurring presentations across 7 validated neurodevelopmental screening tools.',
  },
];

const STATS = [
  { value: '142+', label: 'Cases Analysed' },
  { value: '94%',  label: 'Screening Accuracy' },
  { value: '7',    label: 'Validated Tools' },
  { value: '3',    label: 'Risk Tiers' },
];

const STEPS = [
  {
    num: '01',
    title: 'Select a Screening Tool',
    desc: 'Choose from RAADS-R, AQ-10, ASRS, BRIEF-2 and more — matched to the patient\'s referral profile.',
  },
  {
    num: '02',
    title: 'Administer & Score',
    desc: 'Structured digital administration with automatic scoring and real-time progress tracking.',
  },
  {
    num: '03',
    title: 'Review XAI Report',
    desc: 'Receive a SHAP-explained risk report that surfaces the top clinical signals and contextualises the score.',
  },
];

/* ─── Styles ────────────────────────────────────────────── */
const S = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg)',
    fontFamily: 'var(--font-body)',
    display: 'flex',
    flexDirection: 'column',
  },

  /* NAV */
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(250,250,248,0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--color-neutral-200)',
    padding: '0 5%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '60px',
  },
  navBrand: {
    display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none',
  },
  navLogo: {
    width: '32px', height: '32px', borderRadius: '8px',
    background: 'linear-gradient(140deg, #7C9A85, #5E7A67)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: '14px',
    boxShadow: '0 2px 8px rgba(124,154,133,0.35)',
  },
  navName: {
    fontSize: '1rem', fontWeight: 600, color: 'var(--color-neutral-900)',
    letterSpacing: '-0.02em',
  },
  navLinks: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
  },
  navLink: {
    fontSize: 'var(--font-size-sm)', color: 'var(--color-neutral-600)',
    fontWeight: 500, textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },

  /* HERO */
  hero: {
    padding: '96px 5% 80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 'var(--space-6)',
    position: 'relative',
    overflow: 'hidden',
  },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '5px 14px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid rgba(124,154,133,0.35)',
    backgroundColor: 'rgba(124,154,133,0.08)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--color-primary-dark)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  heroDot: {
    width: '6px', height: '6px', borderRadius: '50%',
    backgroundColor: 'var(--color-primary)',
    animation: 'pulse-dot 1.8s ease-in-out infinite',
  },
  heroH1: {
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: '-0.035em',
    color: 'var(--color-neutral-900)',
    maxWidth: '760px',
  },
  heroAccent: {
    background: 'linear-gradient(135deg, #7C9A85 0%, #5E7A67 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-neutral-500)',
    lineHeight: 1.6,
    maxWidth: '560px',
    fontWeight: 400,
  },
  heroCtas: {
    display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center',
    marginTop: 'var(--space-2)',
  },
  heroDecor: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 50%, rgba(124,154,133,0.06) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(138,129,120,0.05) 0%, transparent 40%)
    `,
    pointerEvents: 'none',
    zIndex: -1,
  },

  /* STATS */
  statsSection: {
    padding: '0 5% 64px',
    display: 'flex',
    justifyContent: 'center',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1px',
    backgroundColor: 'var(--color-neutral-200)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    maxWidth: '800px',
    width: '100%',
    boxShadow: 'var(--shadow-sm)',
  },
  statItem: {
    backgroundColor: 'var(--color-bg-card)',
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-3xl)',
    fontWeight: 700,
    color: 'var(--color-neutral-900)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },

  /* FEATURES */
  featuresSection: {
    padding: '64px 5%',
    backgroundColor: 'var(--color-bg-alt)',
  },
  sectionLabel: {
    textAlign: 'center',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--color-primary)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 'var(--space-3)',
  },
  sectionH2: {
    textAlign: 'center',
    fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
    fontWeight: 700,
    color: 'var(--color-neutral-900)',
    letterSpacing: '-0.025em',
    marginBottom: 'var(--space-12)',
    lineHeight: 1.2,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 'var(--space-5)',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  featureCard: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    boxShadow: 'var(--shadow-xs)',
    transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
  },
  featureIcon: (bg) => ({
    width: '44px', height: '44px', borderRadius: '10px',
    backgroundColor: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }),
  featureTitle: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 600,
    color: 'var(--color-neutral-900)',
  },
  featureDesc: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-500)',
    lineHeight: 1.65,
  },

  /* HOW IT WORKS */
  howSection: {
    padding: '80px 5%',
  },
  stepsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 'var(--space-8)',
    maxWidth: '900px',
    margin: '0 auto',
  },
  stepCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  },
  stepNum: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-3xl)',
    fontWeight: 700,
    color: 'var(--color-neutral-200)',
    lineHeight: 1,
  },
  stepTitle: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 600,
    color: 'var(--color-neutral-800)',
  },
  stepDesc: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-500)',
    lineHeight: 1.65,
  },

  /* CTA BANNER */
  ctaBanner: {
    margin: '0 5% 80px',
    padding: '60px 48px',
    borderRadius: 'var(--radius-2xl)',
    background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 'var(--space-5)',
    boxShadow: '0 8px 32px rgba(94,122,103,0.3)',
  },
  ctaH2: {
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
  },
  ctaSub: {
    fontSize: 'var(--font-size-base)',
    color: 'rgba(255,255,255,0.75)',
    maxWidth: '480px',
    lineHeight: 1.6,
  },

  /* FOOTER */
  footer: {
    borderTop: '1px solid var(--color-neutral-200)',
    padding: '24px 5%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
  },
};

/* ─── Button helpers ────────────────────────────────────── */
function BtnPrimary({ children, to, onClick, id, large }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: large ? '14px 32px' : '10px 24px',
    borderRadius: 'var(--radius-lg)',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: '#fff',
    fontSize: large ? 'var(--font-size-md)' : 'var(--font-size-sm)',
    fontWeight: 600, cursor: 'pointer', border: 'none',
    fontFamily: 'var(--font-body)',
    boxShadow: '0 4px 14px rgba(124,154,133,0.35)',
    transition: 'all var(--transition-base)',
    textDecoration: 'none',
  };
  if (to) return <Link id={id} to={to} style={style}>{children}</Link>;
  return <button id={id} style={style} onClick={onClick}>{children}</button>;
}

function BtnOutline({ children, to, onClick, id, large, light }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: large ? '14px 32px' : '10px 24px',
    borderRadius: 'var(--radius-lg)',
    border: `1.5px solid ${light ? 'rgba(255,255,255,0.4)' : 'var(--color-neutral-300)'}`,
    backgroundColor: 'transparent',
    color: light ? 'rgba(255,255,255,0.9)' : 'var(--color-neutral-700)',
    fontSize: large ? 'var(--font-size-md)' : 'var(--font-size-sm)',
    fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    transition: 'all var(--transition-fast)',
    textDecoration: 'none',
  };
  if (to) return <Link id={id} to={to} style={style}>{children}</Link>;
  return <button id={id} style={style} onClick={onClick}>{children}</button>;
}

/* ─── Component ─────────────────────────────────────────── */
export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div style={S.page}>

      {/* ── Navbar ──────────────────────────────────────── */}
      <nav style={S.nav} aria-label="Site navigation">
        <Link to="/" style={S.navBrand}>
          <span style={S.navLogo}>N</span>
          <span style={S.navName}>NeuroSense</span>
        </Link>
        <div style={S.navLinks}>
          <a href="#features" style={S.navLink}>Features</a>
          <a href="#how-it-works" style={S.navLink}>How it Works</a>
          <BtnOutline to="/auth" id="nav-login-btn">Sign In</BtnOutline>
          <BtnPrimary to="/auth" id="nav-signup-btn">Get Started →</BtnPrimary>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section style={S.hero} aria-label="Hero">
        <div style={S.heroDecor} aria-hidden="true" />

        <div style={S.heroBadge}>
          <span style={S.heroDot} />
          DPDP Act 2023 Compliant · India-First
        </div>

        <h1 style={S.heroH1}>
          Clinical intelligence for{' '}
          <span style={S.heroAccent}>neurodevelopmental</span>{' '}
          screening
        </h1>

        <p style={S.heroSub}>
          NeuroSense combines validated assessment tools with explainable AI to help
          clinicians identify, stratify, and manage ASD, ADHD, and co-occurring conditions
          — with full transparency into every prediction.
        </p>

        <div style={S.heroCtas}>
          <BtnPrimary to="/auth" id="hero-get-started" large>
            Get Started Free →
          </BtnPrimary>
          <BtnOutline to="#how-it-works" id="hero-learn-more" large>
            See how it works
          </BtnOutline>
        </div>

        {/* Mini trust bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginTop: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['7 Validated Tools', 'SHAP Explainability', 'No Black Boxes', 'Audit Logging'].map((t) => (
            <span key={t} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────── */}
      <section style={S.statsSection} aria-label="Key statistics">
        <div style={S.statsGrid}>
          {STATS.map((s) => (
            <div key={s.label} style={S.statItem}>
              <span style={S.statValue}>{s.value}</span>
              <span style={S.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" style={S.featuresSection} aria-label="Features">
        <p style={S.sectionLabel}>What NeuroSense offers</p>
        <h2 style={S.sectionH2}>Built for clinical rigour</h2>
        <div style={S.featuresGrid}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                ...S.featureCard,
                boxShadow: hovered === i ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                transform: hovered === i ? 'translateY(-4px)' : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={S.featureIcon(f.bg)}>
                <span style={{ color: f.color }}>{f.icon}</span>
              </div>
              <div style={S.featureTitle}>{f.title}</div>
              <div style={S.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section id="how-it-works" style={S.howSection} aria-label="How it works">
        <p style={S.sectionLabel}>Process</p>
        <h2 style={S.sectionH2}>Three steps to a clinically<br />grounded assessment</h2>
        <div style={S.stepsRow}>
          {STEPS.map((step) => (
            <div key={step.num} style={S.stepCard}>
              <div style={S.stepNum}>{step.num}</div>
              <div style={{ width: '40px', height: '2px', backgroundColor: 'var(--color-primary)', borderRadius: '2px', opacity: 0.6 }} />
              <div style={S.stepTitle}>{step.title}</div>
              <div style={S.stepDesc}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────── */}
      <div style={S.ctaBanner}>
        <h2 style={S.ctaH2}>Ready to improve clinical outcomes?</h2>
        <p style={S.ctaSub}>
          Join clinicians using NeuroSense to make faster, more transparent neurodevelopmental
          assessments — backed by validated science and explainable AI.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link
            to="/auth"
            id="cta-start-btn"
            style={{
              padding: '14px 32px', borderRadius: 'var(--radius-lg)',
              backgroundColor: '#fff',
              color: 'var(--color-primary-dark)',
              fontWeight: 700, fontSize: 'var(--font-size-md)',
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              transition: 'all var(--transition-fast)',
            }}
          >
            Start for free →
          </Link>
          <BtnOutline id="cta-demo-btn" light large to="/auth">
            Try demo
          </BtnOutline>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={S.footer}>
        <span style={S.footerText}>© 2024 NeuroSense · Clinical Intelligence Platform</span>
        <div style={{ display: 'flex', gap: 'var(--space-5)' }}>
          {['Privacy', 'DPDP Compliance', 'Terms', 'Support'].map((l) => (
            <a key={l} href="#" style={{ ...S.footerText, textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <span style={{ ...S.footerText, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          DPDP Act 2023 Compliant
        </span>
      </footer>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
