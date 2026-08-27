/**
 * Landing.jsx — Professional homepage. Inclusive messaging for clinicians,
 * parents, and individuals. No demo mode. Better logo, generous spacing.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';

/* ── Shared logo SVG ─────────────────────────────────────── */
export function NeuroLogo({ size = 36 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-label="NeuroSense logo"
    >
      <rect width="40" height="40" rx="10" fill="url(#lg)" />
      {/* Neural node connections */}
      <circle cx="20" cy="13" r="3" fill="rgba(255,255,255,0.9)" />
      <circle cx="13" cy="24" r="2.5" fill="rgba(255,255,255,0.75)" />
      <circle cx="27" cy="24" r="2.5" fill="rgba(255,255,255,0.75)" />
      <circle cx="20" cy="31" r="2" fill="rgba(255,255,255,0.6)" />
      {/* Synaptic lines */}
      <line x1="20" y1="16" x2="13" y2="21.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="20" y1="16" x2="27" y2="21.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="13" y1="26.5" x2="20" y2="29" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="27" y1="26.5" x2="20" y2="29" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13" y1="24" x2="27" y2="24" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C9A85" />
          <stop offset="1" stopColor="#4A7259" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── SVG icon set ────────────────────────────────────────── */
const IcoBrain = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96-.46 2.5 2.5 0 01-1.07-4.69 3 3 0 01.34-5.58 2.5 2.5 0 013.19-3.77z"/>
    <path d="M14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96-.46 2.5 2.5 0 001.07-4.69 3 3 0 00-.34-5.58 2.5 2.5 0 00-3.19-3.77z"/>
  </svg>
);
const IcoClipboard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
);
const IcoUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IcoShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IcoStethoscope = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3"/>
    <path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/>
    <circle cx="20" cy="10" r="2"/>
  </svg>
);
const IcoHeart = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </svg>
);
const IcoPerson = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

/* ── Data ────────────────────────────────────────────────── */
const FEATURES = [
  {
    Icon: IcoBrain,
    color: '#7C9A85', bg: 'rgba(124,154,133,0.1)', border: 'rgba(124,154,133,0.2)',
    title: 'Explainable AI',
    desc: 'Every risk score comes with a plain-language explanation of which signals drove it — no hidden algorithms.',
  },
  {
    Icon: IcoClipboard,
    color: '#B8873A', bg: 'rgba(184,135,58,0.08)', border: 'rgba(184,135,58,0.2)',
    title: '7 Validated Tools',
    desc: 'AQ-10, RAADS-R, ASRS, BRIEF-2 and more — internationally recognised instruments in one place.',
  },
  {
    Icon: IcoUsers,
    color: '#5E7A67', bg: 'rgba(94,122,103,0.1)', border: 'rgba(94,122,103,0.2)',
    title: 'For Everyone',
    desc: 'Designed for clinicians, parents, teachers, and individuals — accessible language at every step.',
  },
  {
    Icon: IcoShield,
    color: '#6B6560', bg: 'rgba(107,101,96,0.08)', border: 'rgba(107,101,96,0.2)',
    title: 'Private by Design',
    desc: 'DPDP Act 2023 compliant. Your data never leaves your control and is never sold or shared.',
  },
];

const STATS = [
  { value: '142+', label: 'Screenings done' },
  { value: '94%',  label: 'Accuracy rate' },
  { value: '7',    label: 'Validated tools' },
  { value: '100%', label: 'Private & secure' },
];

const WHO_FOR = [
  {
    Icon: IcoStethoscope,
    color: '#7C9A85', bg: 'rgba(124,154,133,0.1)', border: 'rgba(124,154,133,0.2)',
    title: 'Clinicians & Psychologists',
    desc: 'Run structured assessments, generate SHAP-explained reports, and manage your full caseload in one place.',
  },
  {
    Icon: IcoHeart,
    color: '#B8873A', bg: 'rgba(184,135,58,0.08)', border: 'rgba(184,135,58,0.2)',
    title: 'Parents & Caregivers',
    desc: 'Understand your child\'s screening results with clear, jargon-free explanations — and know what to do next.',
  },
  {
    Icon: IcoPerson,
    color: '#5E7A67', bg: 'rgba(94,122,103,0.1)', border: 'rgba(94,122,103,0.2)',
    title: 'Individuals',
    desc: 'Self-refer, complete an evidence-based screening, and get a transparent report to share with your doctor.',
  },
];

const STEPS = [
  { num: '01', title: 'Choose your track', desc: 'Pick the adult self-report or child caregiver screening flow first. NeuroSense routes you into the correct age-based model and experience.' },
  { num: '02', title: 'Complete a screening', desc: 'Answer validated questions at your own pace. Save and continue any time — no pressure.' },
  { num: '03', title: 'Read your report', desc: 'Get a clear risk rating plus an AI explanation of exactly what influenced the result.' },
];

/* ── Logo + wordmark ─────────────────────────────────────── */
function Brand({ size = 32 }) {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
      <NeuroLogo size={size} />
      <span style={{ fontSize: size === 32 ? '1rem' : '1.125rem', fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
        NeuroSense
      </span>
    </Link>
  );
}

export default function Landing() {
  const [hovFeat, setHovFeat] = useState(null);
  const [hovWho, setHovWho]   = useState(null);

  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: 'var(--color-bg)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(250,250,248,0.9)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--color-neutral-200)',
        padding: '0 6%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px',
      }} aria-label="Site navigation">
        <Brand size={32} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[['#features', 'Features'], ['#who', 'Who it\'s for'], ['#how', 'How it works']].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500, textDecoration: 'none' }}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/auth" id="nav-signin" style={{
              padding: '8px 18px', borderRadius: '9px',
              border: '1.5px solid var(--color-neutral-300)',
              backgroundColor: 'transparent', color: 'var(--color-neutral-700)',
              fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}>Sign In</Link>
            <Link to="/auth?mode=register" id="nav-signup" style={{
              padding: '8px 20px', borderRadius: '9px', border: 'none',
              background: 'linear-gradient(135deg, #7C9A85, #4A7259)',
              color: '#fff', fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              boxShadow: '0 2px 10px rgba(94,122,103,0.3)',
            }}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section style={{
        padding: '96px 6% 88px',
        position: 'relative', overflow: 'hidden',
      }} aria-label="Hero section">
        {/* Subtle bg radials */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,154,133,0.08) 0%, transparent 70%),
            radial-gradient(circle at 15% 80%, rgba(184,135,58,0.04) 0%, transparent 40%),
            radial-gradient(circle at 85% 70%, rgba(94,122,103,0.04) 0%, transparent 40%)
          `,
        }} aria-hidden="true" />

        {/* Centred inner column — same pattern as Features/Who/How */}
        <div style={{
          maxWidth: '820px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '28px',
          position: 'relative',
        }}>

          {/* Pill badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '6px 16px', borderRadius: '999px',
            border: '1px solid rgba(124,154,133,0.3)',
            backgroundColor: 'rgba(124,154,133,0.07)',
            fontSize: '0.75rem', fontWeight: 600, color: '#4A7259',
            letterSpacing: '0.03em',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7C9A85', flexShrink: 0,
              animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Adult and child ASD screening tracks
          </div>

          {/* H1 */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5.5vw, 3.75rem)',
            fontWeight: 800, lineHeight: 1.08,
            letterSpacing: '-0.04em', color: 'var(--color-neutral-900)',
            margin: 0,
          }}>
            Understand your mind
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #7C9A85 10%, #4A7259 90%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>with clarity and confidence.</span>
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.125rem)',
            color: 'var(--color-neutral-500)', lineHeight: 1.75,
            maxWidth: '560px', margin: 0, fontWeight: 400,
          }}>
            NeuroSense combines validated assessment tools with explainable AI to guide
            adult self-report screening and caregiver-led child screening, each with its own
            model pipeline, language, and explainable result.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/app/screening/adult" id="hero-cta-primary" style={{
              padding: '14px 32px', borderRadius: '11px', border: 'none',
              background: 'linear-gradient(135deg, #7C9A85, #4A7259)',
              color: '#fff', fontSize: '1rem', fontWeight: 700,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 18px rgba(94,122,103,0.35)',
            }}>
              Start adult screening
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </Link>
            <Link to="/app/screening/child" id="hero-cta-secondary" style={{
              padding: '14px 28px', borderRadius: '11px',
              border: '1.5px solid #E6C79A',
              backgroundColor: 'var(--color-bg-card)',
              color: '#8A6028', fontSize: '1rem', fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}>
              Start child screening
            </Link>
            <a href="#how" id="hero-cta-tertiary" style={{
              padding: '14px 24px', borderRadius: '11px',
              border: '1.5px solid var(--color-neutral-300)',
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-neutral-700)', fontSize: '1rem', fontWeight: 500,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}>
              See how it works
            </a>
          </div>

          {/* Trust row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['7 Validated Tools', 'AI-explained results', 'No clinical jargon', 'DPDP compliant'].map((t) => (
              <span key={t} style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C9A85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats band ──────────────────────────────────────── */}
      <div style={{ padding: '0 6% 80px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          width: '100%', maxWidth: '780px',
          border: '1px solid var(--color-neutral-200)',
          borderRadius: '16px', overflow: 'hidden',
          backgroundColor: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              padding: '28px 20px', textAlign: 'center',
              borderRight: i < STATS.length - 1 ? '1px solid var(--color-neutral-200)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-neutral-900)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', marginTop: '5px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 6%', backgroundColor: 'var(--color-bg-alt)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>What makes NeuroSense different</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.03em', marginBottom: '52px', lineHeight: 1.15 }}>
            Built for understanding,<br />not just diagnosis.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {FEATURES.map((f, i) => {
              const { Icon } = f;
              return (
                <div
                  key={f.title}
                  onMouseEnter={() => setHovFeat(i)} onMouseLeave={() => setHovFeat(null)}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: `1px solid ${hovFeat === i ? f.border : 'var(--color-neutral-200)'}`,
                    borderRadius: '16px', padding: '28px',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    boxShadow: hovFeat === i ? 'var(--shadow-lg)' : 'var(--shadow-xs)',
                    transform: hovFeat === i ? 'translateY(-4px)' : 'none',
                    transition: 'all 220ms cubic-bezier(.4,0,.2,1)',
                  }}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    backgroundColor: f.bg, border: `1px solid ${f.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: f.color,
                  }}><Icon /></div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.01em' }}>{f.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Who it's for ────────────────────────────────────── */}
      <section id="who" style={{ padding: '88px 6%' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Who it's for</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.03em', marginBottom: '52px', lineHeight: 1.15 }}>
            Wherever you are on<br />the journey.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {WHO_FOR.map((w, i) => {
              const { Icon } = w;
              return (
                <div
                  key={w.title}
                  onMouseEnter={() => setHovWho(i)} onMouseLeave={() => setHovWho(null)}
                  style={{
                    padding: '32px 28px',
                    border: `1px solid ${hovWho === i ? w.border : 'var(--color-neutral-200)'}`,
                    borderRadius: '16px',
                    backgroundColor: hovWho === i ? w.bg : 'var(--color-bg-card)',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    transition: 'all 200ms', boxShadow: hovWho === i ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                  }}
                >
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    backgroundColor: w.bg, border: `1px solid ${w.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: w.color,
                  }}><Icon /></div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.01em' }}>{w.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.7 }}>{w.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how" style={{ padding: '88px 6%', backgroundColor: 'var(--color-bg-alt)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>The process</p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.03em', marginBottom: '56px', lineHeight: 1.15 }}>
            Three steps to answers.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '40px' }}>
            {STEPS.map((step) => (
              <div key={step.num} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 800, color: 'rgba(124,154,133,0.25)', lineHeight: 1 }}>{step.num}</div>
                <div style={{ width: '36px', height: '2.5px', backgroundColor: '#7C9A85', borderRadius: '2px' }} />
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-800)' }}>{step.title}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.65 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <section style={{ padding: '0 6% 88px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #4A7259 0%, #7C9A85 100%)',
          borderRadius: '20px', padding: '72px 48px',
          textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
          boxShadow: '0 8px 40px rgba(74,114,89,0.25)',
        }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.75)', maxWidth: '440px', lineHeight: 1.65, margin: 0 }}>
            Join individuals, families, and clinicians who trust NeuroSense to make
            neurodevelopmental screening clear and accessible.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/auth?mode=register" id="cta-signup-btn" style={{
              padding: '13px 30px', borderRadius: '10px',
              backgroundColor: '#fff', color: '#4A7259',
              fontWeight: 700, fontSize: '0.9375rem', textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}>Create a free account →</Link>
            <Link to="/auth" id="cta-signin-btn" style={{
              padding: '13px 28px', borderRadius: '10px',
              border: '1.5px solid rgba(255,255,255,0.4)',
              color: 'rgba(255,255,255,0.9)', fontWeight: 500,
              fontSize: '0.9375rem', textDecoration: 'none',
            }}>Sign in</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={{
        marginTop: 'auto', borderTop: '1px solid var(--color-neutral-200)',
        padding: '28px 6%', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      }}>
        <Brand size={28} />
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Privacy', 'Terms', 'Accessibility', 'Contact'].map((l) => (
            <a key={l} href="#" style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-400)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7C9A85" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          DPDP Act 2023 Compliant
        </span>
      </footer>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.6); }
        }
      `}</style>
    </div>
  );
}
