/**
 * Landing.jsx — NeuroSense public homepage.
 * Hero: the multimodal signal network. Then: how it works, capabilities, responsible-use, CTA.
 * Wording is deliberately "screening support / risk assessment": NeuroSense never claims to diagnose.
 */
import { Link } from 'react-router-dom';
import PublicNavbar from '../components/layout/PublicNavbar';
import HowItWorks from '../components/marketing/HowItWorks';
import SectionHeader from '../components/ui/SectionHeader';
import SignalVisualization from '../components/ui/SignalVisualization';
import { NeuroSenseLogo, NeuroSenseMark } from '../components/branding/NeuroSenseLogo';

/* Kept for older imports (Sidebar/Auth used to import it from here). */
export function NeuroLogo({ size = 32 }) {
  return <NeuroSenseMark size={size} />;
}

const ico = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const CAPABILITIES = [
  {
    title: 'Explainable by design',
    desc: 'Every result comes with the factors that pushed it up or down (SHAP and LIME), written for a clinician and a caregiver alike.',
    icon: <svg {...ico}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>,
  },
  {
    title: 'Honest about missing signals',
    desc: 'If a gaze, speech or facial signal is skipped or fails quality checks, it is shown as unavailable and never substituted with a guess.',
    icon: <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>,
  },
  {
    title: 'Age-appropriate tracks',
    desc: 'Separate adult, child and toddler questionnaires with their own models and language, so questions fit the person being screened.',
    icon: <svg {...ico}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 7.5a3 3 0 010 5.5M21 20c0-2.4-1.4-4.4-3.4-5.4" /></svg>,
  },
  {
    title: 'Private by default',
    desc: 'Video is never recorded or stored. Only derived gaze coordinates and features are analysed, and each case belongs to the account that created it.',
    icon: <svg {...ico}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>,
  },
];

export default function Landing() {
  return (
    <div style={{ background: 'var(--ns-surface)' }}>
      <PublicNavbar />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="ns-dark ns-hero" aria-labelledby="hero-title">
        <div className="ns-hero__grid" aria-hidden="true" />
        <div className="ns-container ns-hero__inner">
          <div className="ns-hero__copy">
            <p className="ns-eyebrow ns-eyebrow--dark ns-reveal">AI-assisted neurodevelopmental screening</p>
            <h1 id="hero-title" className="ns-display ns-reveal" data-delay="1" style={{ color: '#F4F7FB', marginTop: 18 }}>
              Understanding behavior through <span className="ns-hero__accent">intelligent signals.</span>
            </h1>
            <p className="ns-lede ns-reveal" data-delay="2" style={{ color: '#A9B8CF', marginTop: 22 }}>
              NeuroSense brings a questionnaire, gaze and speech signals together to support early risk
              assessment — with a clear account of what each signal contributed and how reliable it was.
            </p>
            <div className="ns-reveal" data-delay="3" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 34 }}>
              <Link to="/app/screening" id="hero-cta-primary" className="btn btn-signal btn-lg">Start Screening</Link>
              <a href="#how-it-works" id="hero-cta-secondary" className="btn btn-outline-dark btn-lg">Explore NeuroSense</a>
            </div>
            <p className="ns-reveal" data-delay="3" style={{ marginTop: 26, fontSize: '0.8rem', color: '#7F92AF', maxWidth: 460 }}>
              Screening support for qualified review — not a diagnosis.
            </p>
          </div>
          <div className="ns-hero__visual ns-reveal" data-delay="2">
            <SignalVisualization />
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: 'clamp(64px, 9vw, 112px) 0' }} aria-labelledby="hiw-title">
        <div className="ns-container">
          <SectionHeader
            eyebrow="How it works" title="Four stages, one screening insight"
            description="Each signal is captured and scored on its own, checked for quality, and only then combined — so the final indicator is never stronger than the evidence behind it."
            align="center" as="h2"
          />
          <div id="hiw-title" style={{ height: 0 }} />
          <div style={{ marginTop: 48 }}><HowItWorks /></div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────── */}
      <section id="capabilities" style={{ padding: '0 0 clamp(64px, 9vw, 112px)' }}>
        <div className="ns-container">
          <div className="ns-caps">
            {CAPABILITIES.map((c) => (
              <article key={c.title} className="ns-card ns-card--interactive" style={{ padding: 26 }}>
                <span className="ns-caps__icon">{c.icon}</span>
                <h3 style={{ fontSize: '1.08rem', margin: '18px 0 8px' }}>{c.title}</h3>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--ns-n600)', maxWidth: 'none' }}>{c.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / responsible use ────────────────────────── */}
      <section id="about" className="ns-dark" style={{ padding: 'clamp(56px, 8vw, 96px) 0' }}>
        <div className="ns-container ns-about">
          <SectionHeader
            tone="dark" eyebrow="About" title="Built to support clinicians, not replace them"
            description="NeuroSense estimates screening risk from questionnaire, gaze and speech signals. It does not diagnose autism or any other condition. Results are indicators for a qualified professional to interpret alongside clinical judgement."
          />
          <ul className="ns-about__list">
            {[
              ['Research-grade models', 'Signal models are trained on published datasets and shown with their validation status; models that have not met their validation threshold are displayed but do not change the final indicator.'],
              ['Transparent quality', 'Calibration quality, usable-sample counts and model versions are reported next to every signal.'],
              ['One source of truth', 'The final indicator is computed on the server. What you see on screen is what was stored with the case.'],
            ].map(([t, d]) => (
              <li key={t}>
                <span aria-hidden="true" />
                <div><strong>{t}</strong><p>{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA + footer ───────────────────────────────────── */}
      <section style={{ padding: 'clamp(56px, 8vw, 96px) 0', textAlign: 'center' }}>
        <div className="ns-container">
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.6vw, 2.5rem)', letterSpacing: '-0.03em' }}>Begin a screening in a few minutes</h2>
          <p style={{ margin: '14px auto 30px', maxWidth: 520, color: 'var(--ns-n600)' }}>Create an account, choose a track, and complete the steps you are comfortable with. Every step is optional except the questionnaire.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/auth?mode=register" id="cta-create-account" className="btn btn-primary btn-lg">Create account</Link>
            <Link to="/auth" id="cta-sign-in" className="btn btn-secondary btn-lg">Sign in</Link>
          </div>
        </div>
      </section>
      <footer style={{ borderTop: '1px solid var(--ns-n200)', padding: '28px 0 40px' }}>
        <div className="ns-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <NeuroSenseLogo size={24} descriptor />
          <p style={{ fontSize: '0.78rem', color: 'var(--ns-n500)', maxWidth: 520 }}>
            NeuroSense provides AI-assisted screening support and is not a diagnostic device. Always consult a qualified healthcare professional.
          </p>
        </div>
      </footer>

      <style>{`
        .ns-hero{position:relative;overflow:hidden;padding:clamp(112px,14vw,152px) 0 clamp(56px,8vw,96px)}
        .ns-hero::before{content:"";position:absolute;inset:0;background:
          radial-gradient(700px 420px at 78% 40%, rgba(34,211,238,.13), transparent 65%),
          radial-gradient(600px 400px at 8% 0%, rgba(38,54,90,.6), transparent 70%)}
        .ns-hero__grid{position:absolute;inset:0;opacity:.5;
          background-image:linear-gradient(rgba(148,163,184,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.07) 1px,transparent 1px);
          background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse at 60% 40%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse at 60% 40%,#000 20%,transparent 75%)}
        .ns-hero__inner{position:relative;display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,1fr);gap:clamp(24px,4vw,56px);align-items:center}
        .ns-hero__accent{background:linear-gradient(100deg,#22D3EE,#5EEAD4);-webkit-background-clip:text;background-clip:text;color:transparent}
        .ns-caps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
        .ns-caps__icon{display:inline-flex;width:44px;height:44px;border-radius:12px;align-items:center;justify-content:center;color:var(--ns-instrument);background:var(--ns-instrument-dim)}
        .ns-about{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(24px,5vw,72px);align-items:start}
        .ns-about__list{list-style:none;margin:0;padding:0;display:grid;gap:22px}
        .ns-about__list li{display:flex;gap:16px}
        .ns-about__list li>span{flex:0 0 2px;background:linear-gradient(#22D3EE,transparent);border-radius:2px}
        .ns-about__list strong{color:#F4F7FB;font-family:var(--font-heading);font-weight:600;font-size:1rem}
        .ns-about__list p{margin-top:6px;font-size:.9rem;line-height:1.6;max-width:none}
        @media (max-width:1000px){.ns-caps{grid-template-columns:repeat(2,minmax(0,1fr))}.ns-hero__inner,.ns-about{grid-template-columns:1fr}}
        @media (max-width:560px){.ns-caps{grid-template-columns:1fr}#hero-cta-primary,#hero-cta-secondary{width:100%}}
      `}</style>
    </div>
  );
}
