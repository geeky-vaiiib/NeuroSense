/**
 * Landing.jsx — Premium ASD screening landing page with 3D neural network,
 * glassmorphism, dark/light mode, and cinematic animations.
 */
import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

const NeuralNetwork3D = lazy(() => import('../components/NeuralNetwork3D'));

/* ── Logo ────────────────────────────────────────────────── */
export function NeuroLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-label="NeuroSense logo">
      <rect width="40" height="40" rx="10" fill="url(#lg)" />
      <circle cx="20" cy="13" r="3" fill="rgba(255,255,255,0.9)" />
      <circle cx="13" cy="24" r="2.5" fill="rgba(255,255,255,0.75)" />
      <circle cx="27" cy="24" r="2.5" fill="rgba(255,255,255,0.75)" />
      <circle cx="20" cy="31" r="2" fill="rgba(255,255,255,0.6)" />
      <line x1="20" y1="16" x2="13" y2="21.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="20" y1="16" x2="27" y2="21.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="13" y1="26.5" x2="20" y2="29" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="27" y1="26.5" x2="20" y2="29" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="13" y1="24" x2="27" y2="24" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeLinecap="round" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-primary)" /><stop offset="1" stopColor="var(--color-primary-dark)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Animated counter ────────────────────────────────────── */
function AnimatedNumber({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const num = parseInt(target) || 0;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        let start = 0;
        const step = Math.max(1, Math.floor(num / 40));
        const id = setInterval(() => { start += step; if (start >= num) { setVal(num); clearInterval(id); } else setVal(start); }, 30);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Scroll-reveal wrapper ───────────────────────────────── */
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(30px)', transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── Data ────────────────────────────────────────────────── */
const FEATURES = [
  { icon: '🧠', title: 'Explainable AI', desc: 'Every risk score includes a plain-language SHAP explanation of which signals drove it.', color: 'var(--color-primary)' },
  { icon: '📋', title: '7 Validated Tools', desc: 'AQ-10, RAADS-R, ASRS, BRIEF-2 — internationally recognised instruments in one place.', color: 'var(--color-accent-child)' },
  { icon: '👥', title: 'For Everyone', desc: 'Designed for clinicians, parents, and individuals — accessible language at every step.', color: 'var(--color-accent-adult)' },
  { icon: '🛡️', title: 'Private by Design', desc: 'DPDP Act 2023 compliant. Your data never leaves your control and is never sold.', color: 'var(--color-accent-toddler)' },
];

const STATS = [
  { value: '142', suffix: '+', label: 'Screenings' },
  { value: '94', suffix: '%', label: 'Accuracy' },
  { value: '7', suffix: '', label: 'Tools' },
  { value: '100', suffix: '%', label: 'Private' },
];

const STEPS = [
  { num: '01', title: 'Choose your track', desc: 'Pick adult, child, or toddler screening. NeuroSense routes you into the correct pipeline.' },
  { num: '02', title: 'Complete screening', desc: 'Answer validated questions at your own pace. Save and continue any time.' },
  { num: '03', title: 'Read your report', desc: 'Get a clear risk rating plus an AI explanation of exactly what influenced it.' },
];

const WHO_FOR = [
  { icon: '🩺', title: 'Clinicians', desc: 'Run structured assessments and generate SHAP-explained reports.' },
  { icon: '❤️', title: 'Parents', desc: "Understand your child's results with clear, jargon-free explanations." },
  { icon: '🧑', title: 'Individuals', desc: 'Self-refer, complete screening, and get a transparent report.' },
];

/* ── Glass card ──────────────────────────────────────────── */
function GlassCard({ children, style = {}, hover = true, ...props }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--glass-bg)', backdropFilter: `blur(var(--glass-blur))`, WebkitBackdropFilter: `blur(var(--glass-blur))`,
        border: `1px solid ${hov && hover ? 'var(--color-primary)' : 'var(--glass-border)'}`,
        borderRadius: '20px', padding: '28px',
        boxShadow: hov && hover ? 'var(--shadow-lg), var(--shadow-glow)' : 'var(--glass-shadow)',
        transform: hov && hover ? 'translateY(-4px)' : 'none',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)', ...style,
      }} {...props}
    >{children}</div>
  );
}

/* ── Main Landing ────────────────────────────────────────── */
export default function Landing() {
  const { isDark } = useTheme();

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--color-bg)', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Navbar ──────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)', padding: '0 6%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <NeuroLogo size={32} />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>NeuroSense</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[['#features','Features'],['#who','Who it\'s for'],['#how','How it works']].map(([h,l]) => (
              <a key={h} href={h} style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = 'var(--color-primary)'}
                onMouseLeave={e => e.target.style.color = 'var(--color-neutral-500)'}>{l}</a>
            ))}
          </div>
          <ThemeToggle size={36} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/auth" id="nav-signin" style={{
              padding: '8px 18px', borderRadius: '10px', border: '1.5px solid var(--color-neutral-300)',
              background: 'transparent', color: 'var(--color-neutral-700)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s',
            }}>Sign In</Link>
            <Link to="/auth?mode=register" id="nav-signup" style={{
              padding: '8px 20px', borderRadius: '10px', border: 'none',
              background: 'var(--gradient-primary)', color: isDark ? '#0f172a' : '#fff',
              fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              boxShadow: 'var(--shadow-primary)',
            }}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '40px 6% 60px', minHeight: '85vh', display: 'flex', alignItems: 'center' }}>
        {/* Mesh gradient bg */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--gradient-mesh)', pointerEvents: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1, alignItems: 'center' }}>
          {/* Left: Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Reveal>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '999px',
                border: '1px solid var(--color-primary-muted)', background: 'var(--color-primary-subtle)',
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '0.03em', width: 'fit-content',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', animation: 'ns-pulse 2s ease-in-out infinite' }} />
                Adult · Child · Toddler ASD Screening
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 style={{
                fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', fontWeight: 800, lineHeight: 1.08,
                letterSpacing: '-0.04em', color: 'var(--color-neutral-900)', margin: 0, fontFamily: 'var(--font-display)',
              }}>
                Understand your mind{' '}
                <span style={{ background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  with clarity.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p style={{ fontSize: '1.05rem', color: 'var(--color-neutral-500)', lineHeight: 1.75, maxWidth: '480px', margin: 0 }}>
                NeuroSense combines validated assessment tools with explainable AI for transparent, multi-track neurodevelopmental screening.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link to="/app/screening" id="hero-cta-primary" style={{
                  padding: '14px 32px', borderRadius: '14px', border: 'none', background: 'var(--gradient-primary)',
                  color: isDark ? '#0f172a' : '#fff', fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-primary)',
                  transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                }}>
                  Start screening
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </Link>
                <a href="#how" style={{
                  padding: '14px 24px', borderRadius: '14px', border: '1.5px solid var(--color-neutral-300)',
                  background: 'var(--color-bg-card)', color: 'var(--color-neutral-700)', fontSize: '1rem', fontWeight: 500,
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                }}>See how it works</a>
              </div>
            </Reveal>
            <Reveal delay={400}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {['AI-explained results', 'No clinical jargon', 'DPDP compliant'].map(t => (
                  <span key={t} style={{ fontSize: '0.8rem', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right: 3D Brain */}
          <div style={{ height: '500px', position: 'relative' }}>
            <Suspense fallback={<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-neutral-400)' }}>Loading 3D…</div>}>
              <NeuralNetwork3D isDark={isDark} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────── */}
      <Reveal>
        <div style={{ padding: '0 6% 80px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', width: '100%', maxWidth: '780px',
            border: '1px solid var(--glass-border)', borderRadius: '20px', overflow: 'hidden',
            background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            boxShadow: 'var(--glass-shadow)',
          }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{
                padding: '28px 20px', textAlign: 'center',
                borderRight: i < 3 ? '1px solid var(--glass-border)' : 'none',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--color-neutral-900)', lineHeight: 1 }}>
                  <AnimatedNumber target={s.value} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', marginTop: '6px', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 6%', background: 'var(--color-bg-alt)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>What makes NeuroSense different</p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.03em', marginBottom: '52px', lineHeight: 1.15, fontFamily: 'var(--font-display)' }}>
              Built for understanding,<br />not just diagnosis.
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 100}>
                <GlassCard>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>{f.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.7 }}>{f.desc}</div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────── */}
      <section id="who" style={{ padding: '88px 6%' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Who it's for</p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.03em', marginBottom: '52px', lineHeight: 1.15, fontFamily: 'var(--font-display)' }}>
              Wherever you are on<br />the journey.
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {WHO_FOR.map((w, i) => (
              <Reveal key={w.title} delay={i * 100}>
                <GlassCard>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{w.icon}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>{w.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.7 }}>{w.desc}</div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how" style={{ padding: '88px 6%', background: 'var(--color-bg-alt)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>The process</p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.03em', marginBottom: '56px', lineHeight: 1.15, fontFamily: 'var(--font-display)' }}>
              Three steps to answers.
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '40px' }}>
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 150}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1 }}>{step.num}</div>
                  <div style={{ width: '36px', height: '3px', background: 'var(--gradient-primary)', borderRadius: '2px' }} />
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-neutral-800)', fontFamily: 'var(--font-display)' }}>{step.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-neutral-500)', lineHeight: 1.65 }}>{step.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{ padding: '0 6% 88px' }}>
        <Reveal>
          <div style={{
            background: 'var(--gradient-hero)', borderRadius: '24px', padding: '72px 48px',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
            boxShadow: '0 8px 40px rgba(91,138,114,0.25)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0, fontFamily: 'var(--font-display)', position: 'relative' }}>
              Ready to get started?
            </h2>
            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.75)', maxWidth: '440px', lineHeight: 1.65, margin: 0, position: 'relative' }}>
              Join individuals, families, and clinicians who trust NeuroSense for clear, accessible neurodevelopmental screening.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
              <Link to="/auth?mode=register" id="cta-signup-btn" style={{
                padding: '13px 30px', borderRadius: '12px', background: '#fff', color: 'var(--color-primary-dark)',
                fontWeight: 700, fontSize: '0.9375rem', textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>Create a free account →</Link>
              <Link to="/auth" id="cta-signin-btn" style={{
                padding: '13px 28px', borderRadius: '12px', border: '1.5px solid rgba(255,255,255,0.4)',
                color: 'rgba(255,255,255,0.9)', fontWeight: 500, fontSize: '0.9375rem', textDecoration: 'none',
              }}>Sign in</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer style={{
        marginTop: 'auto', borderTop: '1px solid var(--color-neutral-200)',
        padding: '28px 6%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <NeuroLogo size={28} />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-neutral-900)', fontFamily: 'var(--font-display)' }}>NeuroSense</span>
        </Link>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Privacy','Terms','Accessibility','Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-400)', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          DPDP Act 2023 Compliant
        </span>
      </footer>
    </div>
  );
}
