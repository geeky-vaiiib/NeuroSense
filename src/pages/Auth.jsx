/**
 * Auth.jsx — Login / Register. No demo mode. Inclusive language.
 * Professional logo. Better padding and field UX.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NeuroLogo from '../components/NeuroLogo';

const ROLES = [
  'Clinician / Doctor', 'Clinical Psychologist', 'Neuropsychologist',
  'Psychiatrist', 'Paediatrician', 'Teacher / Educator',
  'Parent / Caregiver', 'Individual (self-referral)', 'Research Fellow', 'Other',
];

/* ── Eye toggle ──────────────────────────────────────────── */
function Eye({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Input field ─────────────────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, required, icon, rightEl, hint, autoComplete }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-neutral-700)' }}>
        {label}{required && <span style={{ color: '#C0555A', marginLeft: '3px' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
            color: foc ? 'var(--color-primary)' : 'var(--color-neutral-400)',
            display: 'flex', alignItems: 'center', pointerEvents: 'none',
            transition: 'color 150ms',
          }}>{icon}</span>
        )}
        <input
          id={id} type={type} value={value} onChange={onChange}
          placeholder={placeholder} required={required}
          autoComplete={autoComplete || (type === 'email' ? 'email' : type === 'password' ? 'current-password' : 'off')}
          onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
          style={{
            width: '100%', height: '44px',
            padding: `0 ${rightEl ? '46px' : '14px'} 0 ${icon ? '42px' : '14px'}`,
            border: `1.5px solid ${foc ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
            borderRadius: '10px',
            backgroundColor: foc ? 'var(--color-bg-card)' : 'var(--color-bg)',
            fontSize: '0.9375rem', color: 'var(--color-neutral-800)',
            fontFamily: 'var(--font-body)', outline: 'none',
            boxShadow: foc ? 'var(--color-primary-glow)' : 'none',
            transition: 'all 150ms',
          }}
        />
        {rightEl && (
          <span style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            {rightEl}
          </span>
        )}
      </div>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

const MailIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
const LockIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
const UserIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;

export default function Auth() {
  const { login, register, isAuthenticated, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [tab, setTab]           = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [showPwd, setShowPwd]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [localErr, setLocalErr] = useState('');

  // Login
  const [email, setEmail]       = useState('');
  const [pwd, setPwd]           = useState('');

  // Register
  const [name, setName]         = useState('');
  const [rEmail, setREmail]     = useState('');
  const [rPwd, setRPwd]         = useState('');
  const [conf, setConf]         = useState('');
  const [role, setRole]         = useState('');

  useEffect(() => { if (isAuthenticated) navigate('/app', { replace: true }); }, [isAuthenticated, navigate]);

  const switchTab = (t) => { setTab(t); setLocalErr(''); clearError(); };

  const handleLogin = async (e) => {
    e.preventDefault(); setLocalErr(''); setBusy(true);
    const ok = await login(email, pwd);
    setBusy(false);
    if (ok) navigate('/app', { replace: true });
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setLocalErr('');
    if (!role) { setLocalErr('Please select your role.'); return; }
    if (rPwd !== conf) { setLocalErr('Passwords do not match.'); return; }
    if (rPwd.length < 8) { setLocalErr('Password must be at least 8 characters.'); return; }
    setBusy(true);
    const ok = await register({ name, email: rEmail, password: rPwd, role });
    setBusy(false);
    if (ok) navigate('/app', { replace: true });
  };

  const err = localErr || error;

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px',
      backgroundImage: `
        radial-gradient(ellipse 60% 40% at 30% 20%, rgba(124,154,133,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 75% 80%, rgba(138,129,120,0.05) 0%, transparent 50%)
      `,
    }}>

      {/* Back link */}
      <Link to="/" style={{
        position: 'absolute', top: '24px', left: '32px',
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '0.8125rem', color: 'var(--color-neutral-500)',
        textDecoration: 'none', fontWeight: 500,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to home
      </Link>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '448px',
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: '20px', boxShadow: '0 8px 40px rgba(26,26,24,0.1)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '36px 36px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <NeuroLogo size={52} />
            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-neutral-900)', letterSpacing: '-0.025em' }}>NeuroSense</span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-neutral-900)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-400)', margin: 0, lineHeight: 1.5 }}>
              {tab === 'login'
                ? 'Sign in to continue your assessments'
                : 'For clinicians, parents, and individuals'}
            </p>
          </div>

          {/* Tab toggle */}
          <div style={{
            display: 'flex', width: '100%',
            backgroundColor: 'var(--color-bg)', borderRadius: '10px', padding: '3px', gap: '3px',
          }}>
            {[['login', 'Sign In'], ['register', 'Create Account']].map(([t, label]) => (
              <button key={t} id={`auth-tab-${t}`} onClick={() => switchTab(t)} aria-selected={tab === t}
                style={{
                  flex: 1, height: '36px', borderRadius: '8px', border: 'none',
                  backgroundColor: tab === t ? 'var(--color-bg-card)' : 'transparent',
                  color: tab === t ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
                  fontSize: '0.8125rem', fontWeight: tab === t ? 700 : 400,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  boxShadow: tab === t ? '0 1px 4px rgba(26,26,24,0.08)' : 'none',
                  transition: 'all 150ms',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 36px 36px' }}>

          {/* Error */}
          {err && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '9px',
              padding: '11px 14px', borderRadius: '9px',
              backgroundColor: '#FFF0F0', border: '1px solid rgba(192,85,90,0.25)',
              marginBottom: '18px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0555A" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span style={{ fontSize: '0.8125rem', color: '#C0555A', fontWeight: 500 }}>{err}</span>
            </div>
          )}

          {/* ─── LOGIN ─── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field id="login-email" label="Email address" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" icon={<MailIcon />} />
              <Field id="login-password" label="Password" type={showPwd ? 'text' : 'password'} required
                value={pwd} onChange={(e) => setPwd(e.target.value)}
                placeholder="••••••••" icon={<LockIcon />}
                rightEl={
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', padding: 0 }}>
                    <Eye open={showPwd} />
                  </button>
                } />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
                <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--clr-primary)', fontWeight: 500, textDecoration: 'none' }}>Forgot password?</a>
              </div>

              <button id="login-submit-btn" type="submit" disabled={busy || isLoading}
                style={{
                  height: '46px', borderRadius: '10px', border: 'none',
                  background: 'var(--grad-cta)',
                  color: 'var(--clr-text-inverse)', fontSize: '0.9375rem', fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  boxShadow: 'var(--shadow-glow)', opacity: busy ? 0.75 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginTop: '4px',
                }}>
                {busy ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign In →'}
              </button>

              <p style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)', textAlign: 'center', margin: 0 }}>
                Don't have an account?{' '}
                <button type="button" onClick={() => switchTab('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--clr-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', padding: 0 }}>
                  Create one →
                </button>
              </p>
            </form>
          )}

          {/* ─── REGISTER ─── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field id="reg-name" label="Full name" required
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your full name" icon={<UserIcon />} autoComplete="name" />
              <Field id="reg-email" label="Email address" type="email" required
                value={rEmail} onChange={(e) => setREmail(e.target.value)}
                placeholder="your@email.com" icon={<MailIcon />} />

              {/* Role */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="reg-role" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-neutral-700)' }}>
                  I am a… <span style={{ color: '#C0555A' }}>*</span>
                </label>
                <select id="reg-role" value={role} onChange={(e) => setRole(e.target.value)}
                  style={{
                    height: '44px', padding: '0 14px',
                    border: '1.5px solid var(--color-neutral-200)', borderRadius: '10px',
                    backgroundColor: 'var(--color-bg)', fontSize: '0.9375rem',
                    color: role ? 'var(--color-neutral-800)' : 'var(--color-neutral-400)',
                    fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
                  }}>
                  <option value="" disabled>Select your role</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <Field id="reg-password" label="Password" type={showPwd ? 'text' : 'password'} required
                value={rPwd} onChange={(e) => setRPwd(e.target.value)}
                placeholder="At least 8 characters" icon={<LockIcon />}
                hint="Use letters, numbers, and symbols"
                autoComplete="new-password"
                rightEl={
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', padding: 0 }}>
                    <Eye open={showPwd} />
                  </button>
                } />

              <Field id="reg-confirm" label="Confirm password" type={showConf ? 'text' : 'password'} required
                value={conf} onChange={(e) => setConf(e.target.value)}
                placeholder="Repeat password" icon={<LockIcon />}
                autoComplete="new-password"
                rightEl={
                  <button type="button" onClick={() => setShowConf(!showConf)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', padding: 0 }}>
                    <Eye open={showConf} />
                  </button>
                } />

              <button id="register-submit-btn" type="submit" disabled={busy}
                style={{
                  height: '46px', borderRadius: '10px', border: 'none',
                  background: 'var(--grad-cta)',
                  color: 'var(--clr-text-inverse)', fontSize: '0.9375rem', fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
                  boxShadow: 'var(--shadow-glow)', opacity: busy ? 0.75 : 1,
                  marginTop: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {busy ? 'Creating account…' : 'Create Account →'}
              </button>

              <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
                By creating an account you agree to our{' '}
                <a href="#" style={{ color: 'var(--clr-primary)', fontWeight: 500, textDecoration: 'none' }}>Terms</a>
                {' '}and{' '}
                <a href="#" style={{ color: 'var(--clr-primary)', fontWeight: 500, textDecoration: 'none' }}>Privacy Policy</a>.
              </p>

              <p style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-500)', textAlign: 'center', margin: 0 }}>
                Already have an account?{' '}
                <button type="button" onClick={() => switchTab('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--clr-primary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', padding: 0 }}>
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Compliance */}
      <p style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        Protected under DPDP Act 2023 · End-to-end encrypted
      </p>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
