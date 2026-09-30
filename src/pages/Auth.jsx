/**
 * Auth.jsx — sign in / create account. Split layout: brand + signal visual on the left,
 * form on the right. Authentication itself is unchanged (see context/AuthContext.jsx).
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NeuroSenseLogo } from '../components/branding/NeuroSenseLogo';
import SignalVisualization from '../components/ui/SignalVisualization';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const EyeIcon = ({ open }) => open ? (
  <svg width="17" height="17" viewBox="0 0 24 24" {...svg}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" {...svg}><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
);
const MailIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
const LockIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
const UserIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;

function Field({ id, label, type = 'text', value, onChange, placeholder, required, icon, toggle, hint, autoComplete, invalid }) {
  const [shown, setShown] = useState(false);
  const isPwd = type === 'password';
  return (
    <div className="ns-field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      <div className="ns-field__wrap">
        <span className="ns-field__icon">{icon}</span>
        <input
          id={id} type={isPwd && shown ? 'text' : type} value={value} onChange={onChange} placeholder={placeholder}
          required={required} aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-hint` : undefined}
          autoComplete={autoComplete || (type === 'email' ? 'email' : isPwd ? 'current-password' : 'off')}
          style={{ paddingRight: toggle || isPwd ? 46 : 14 }}
        />
        {isPwd && (
          <button type="button" className="ns-field__toggle" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
            <EyeIcon open={shown} />
          </button>
        )}
      </div>
      {hint && <div id={`${id}-hint`} className="ns-field__hint">{hint}</div>}
    </div>
  );
}

function PasswordRules({ value }) {
  const rules = [
    ['At least 10 characters', value.length >= 10],
    ['A letter', /[A-Za-z]/.test(value)],
    ['A number', /\d/.test(value)],
  ];
  return (
    <ul className="ns-rules" aria-label="Password requirements">
      {rules.map(([t, ok]) => (
        <li key={t} className={ok ? 'ok' : ''}>
          <svg width="12" height="12" viewBox="0 0 24 24" {...svg} strokeWidth="3">{ok ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="4" />}</svg>
          {t}<span className="sr-only">{ok ? ' — met' : ' — not yet met'}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Auth() {
  const { login, register, isAuthenticated, isLoading, error, expired, clearError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [tab, setTab] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [done, setDone] = useState('');

  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [name, setName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rPwd, setRPwd] = useState('');
  const [conf, setConf] = useState('');

  useEffect(() => { if (isAuthenticated) navigate('/app', { replace: true }); }, [isAuthenticated, navigate]);

  const switchTab = (t) => { setTab(t); setLocalErr(''); setDone(''); clearError(); };

  const handleLogin = async (e) => {
    e.preventDefault(); setLocalErr(''); setBusy(true);
    const ok = await login(email, pwd);
    setBusy(false);
    if (ok) { setDone('Signed in'); navigate('/app', { replace: true }); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setLocalErr('');
    if (rPwd !== conf) { setLocalErr('Passwords do not match.'); return; }
    if (rPwd.length < 10 || !/[A-Za-z]/.test(rPwd) || !/\d/.test(rPwd)) { setLocalErr('Password must be at least 10 characters with a letter and a number.'); return; }
    setBusy(true);
    const ok = await register({ name, email: rEmail, password: rPwd });
    setBusy(false);
    if (ok) { setDone('Account created'); navigate('/app', { replace: true }); }
  };

  const err = localErr || error || (expired ? 'Your session has expired. Please sign in again.' : '');
  const submitting = busy || isLoading;

  return (
    <div className="ns-auth">
      {/* ── Brand panel ─────────────────────────────── */}
      <aside className="ns-auth__brand ns-dark" aria-hidden={false}>
        <div className="ns-auth__grid" aria-hidden="true" />
        <div style={{ position: 'relative' }}>
          <Link to="/" aria-label="NeuroSense home" style={{ display: 'inline-flex' }}><NeuroSenseLogo tone="dark" size={34} descriptor animated /></Link>
        </div>
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 2.6vw, 2.25rem)', letterSpacing: '-0.03em', lineHeight: 1.12, maxWidth: 440 }}>
            Screening support, grounded in <span style={{ color: 'var(--ns-signal)' }}>real signals.</span>
          </h2>
          <p style={{ marginTop: 14, fontSize: '0.95rem', maxWidth: 420, lineHeight: 1.65 }}>
            Questionnaire, gaze and speech signals — combined, explained, and always labelled when unavailable.
          </p>
          <div style={{ maxWidth: 520, marginTop: 8 }}><SignalVisualization interactive={false} /></div>
        </div>
        <p style={{ position: 'relative', fontSize: '0.78rem', color: '#7F92AF', maxWidth: 420 }}>
          Sessions use secure, HttpOnly cookies. Camera video is never recorded or stored.
        </p>
      </aside>

      {/* ── Form panel ──────────────────────────────── */}
      <main className="ns-auth__form">
        <Link to="/" className="ns-auth__back">
          <svg width="14" height="14" viewBox="0 0 24 24" {...svg} strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          Back to home
        </Link>
        <div className="ns-auth__mobile-logo"><NeuroSenseLogo size={30} /></div>

        <div className="ns-auth__card ns-page-enter">
          <h1 style={{ fontSize: '1.65rem', letterSpacing: '-0.03em' }}>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p style={{ marginTop: 8, fontSize: '0.92rem', color: 'var(--ns-n500)' }}>
            {tab === 'login' ? 'Sign in to continue your screenings.' : 'For clinicians, parents and caregivers.'}
          </p>

          <div role="tablist" aria-label="Sign in or create account" className="ns-auth__tabs">
            {[['login', 'Sign in'], ['register', 'Create account']].map(([t, label]) => (
              <button key={t} id={`auth-tab-${t}`} role="tab" aria-selected={tab === t} type="button" onClick={() => switchTab(t)}>{label}</button>
            ))}
          </div>

          {err && (
            <div role="alert" className="ns-auth__alert">
              <svg width="16" height="16" viewBox="0 0 24 24" {...svg}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span>{err}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="ns-auth__fields" noValidate={false}>
              <Field id="login-email" label="Email address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" icon={<MailIcon />} />
              <Field id="login-password" label="Password" type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Your password" icon={<LockIcon />} />
              <button id="login-submit-btn" type="submit" disabled={submitting} className="btn btn-primary btn-lg ns-auth__submit">
                {submitting ? <><span className="ns-spinner" aria-hidden="true" /> Signing in…</> : done || 'Sign in'}
              </button>
              <p className="ns-auth__switch">New to NeuroSense? <button type="button" onClick={() => switchTab('register')}>Create an account</button></p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="ns-auth__fields">
              <Field id="reg-name" label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" icon={<UserIcon />} autoComplete="name" />
              <Field id="reg-email" label="Email address" type="email" required value={rEmail} onChange={(e) => setREmail(e.target.value)} placeholder="you@example.com" icon={<MailIcon />} />
              <Field id="reg-password" label="Password" type="password" required value={rPwd} onChange={(e) => setRPwd(e.target.value)} placeholder="Create a password" icon={<LockIcon />} autoComplete="new-password" hint={<PasswordRules value={rPwd} />} />
              <Field id="reg-confirm" label="Confirm password" type="password" required value={conf} onChange={(e) => setConf(e.target.value)} placeholder="Repeat password" icon={<LockIcon />} autoComplete="new-password" invalid={conf.length > 0 && conf !== rPwd} />
              <button id="register-submit-btn" type="submit" disabled={submitting} className="btn btn-primary btn-lg ns-auth__submit">
                {submitting ? <><span className="ns-spinner" aria-hidden="true" /> Creating account…</> : done || 'Create account'}
              </button>
              <p style={{ fontSize: '0.76rem', color: 'var(--ns-n500)', textAlign: 'center', lineHeight: 1.5, maxWidth: 'none' }}>
                NeuroSense provides screening support and is not a diagnostic device.
              </p>
              <p className="ns-auth__switch">Already have an account? <button type="button" onClick={() => switchTab('login')}>Sign in</button></p>
            </form>
          )}
        </div>
      </main>

      <style>{`
        .ns-auth{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}
        .ns-auth__brand{position:relative;overflow:hidden;padding:clamp(28px,4vw,52px);display:flex;flex-direction:column;justify-content:space-between;gap:24px}
        .ns-auth__brand::before{content:"";position:absolute;inset:0;background:radial-gradient(600px 420px at 70% 60%,rgba(34,211,238,.13),transparent 65%),radial-gradient(500px 360px at 0% 0%,rgba(38,54,90,.6),transparent 70%)}
        .ns-auth__grid{position:absolute;inset:0;opacity:.45;background-image:linear-gradient(rgba(148,163,184,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.07) 1px,transparent 1px);background-size:52px 52px;-webkit-mask-image:radial-gradient(ellipse at 50% 50%,#000 25%,transparent 78%);mask-image:radial-gradient(ellipse at 50% 50%,#000 25%,transparent 78%)}
        .ns-auth__form{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(24px,5vw,56px) clamp(16px,4vw,40px)}
        .ns-auth__back{position:absolute;top:24px;left:clamp(16px,4vw,40px);display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--ns-n500);font-weight:500}
        .ns-auth__back:hover{color:var(--ns-n900)}
        .ns-auth__mobile-logo{display:none;margin-bottom:24px}
        .ns-auth__card{width:100%;max-width:420px}
        .ns-auth__tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:26px 0 22px;padding:4px;background:var(--ns-n150);border-radius:12px}
        .ns-auth__tabs button{height:38px;border-radius:9px;font-size:.84rem;font-weight:500;color:var(--ns-n500);transition:all .15s}
        .ns-auth__tabs button[aria-selected=true]{background:#fff;color:var(--ns-n900);font-weight:600;box-shadow:var(--sh-sm)}
        .ns-auth__alert{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;margin-bottom:18px;background:var(--ns-risk-high-bg);border:1px solid var(--ns-risk-high-border);color:var(--ns-risk-high-text);font-size:.85rem;font-weight:500;line-height:1.45}
        .ns-auth__alert svg{flex-shrink:0;margin-top:1px}
        .ns-auth__fields{display:flex;flex-direction:column;gap:16px}
        .ns-auth__submit{width:100%;height:48px;margin-top:4px}
        .ns-auth__switch{text-align:center;font-size:.84rem;color:var(--ns-n500);max-width:none}
        .ns-auth__switch button{color:var(--ns-instrument);font-weight:600}
        .ns-auth__switch button:hover{text-decoration:underline}
        .ns-field label{display:block;font-size:.8rem;font-weight:600;color:var(--ns-n700);margin-bottom:7px}
        .ns-field__wrap{position:relative}
        .ns-field__icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--ns-n400);display:flex;pointer-events:none}
        .ns-field__wrap:focus-within .ns-field__icon{color:var(--ns-instrument)}
        .ns-field input{width:100%;height:46px;padding:0 14px 0 42px;border:1.5px solid var(--ns-n300);border-radius:12px;background:#fff;font-size:.94rem;color:var(--ns-n900);transition:border-color .15s,box-shadow .15s}
        .ns-field input::placeholder{color:var(--ns-n400)}
        .ns-field input:hover{border-color:var(--ns-n400)}
        .ns-field input:focus{border-color:var(--ns-instrument-light);box-shadow:0 0 0 4px var(--ns-instrument-focus);outline:none}
        .ns-field input[aria-invalid=true]{border-color:var(--ns-risk-high)}
        .ns-field__toggle{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:8px;color:var(--ns-n500);display:flex;align-items:center;justify-content:center}
        .ns-field__toggle:hover{background:var(--ns-n150);color:var(--ns-n900)}
        .ns-field__hint{margin-top:8px}
        .ns-rules{list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.75rem;color:var(--ns-n500)}
        .ns-rules li{display:flex;align-items:center;gap:5px}
        .ns-rules li.ok{color:var(--ns-risk-low-text)}
        .ns-spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:ns-rotate .7s linear infinite}
        @media (max-width:900px){.ns-auth{grid-template-columns:1fr}.ns-auth__brand{display:none}.ns-auth__mobile-logo{display:block}.ns-auth__back{position:static;align-self:flex-start;margin-bottom:20px}.ns-auth__form{justify-content:flex-start;padding-top:28px}}
      `}</style>
    </div>
  );
}
