/**
 * Auth.jsx
 * Login / Register page with animated tab toggle and demo access.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  'Clinician', 'Clinical Psychologist', 'Neuropsychologist',
  'Psychiatrist', 'Paediatrician', 'Research Fellow', 'Other',
];

/* ─── Eye icon ──────────────────────────────────────────── */
function EyeIcon({ open }) {
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

/* ─── Field ─────────────────────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, required, icon, rightEl, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-neutral-700)' }}>
        {label}{required && <span style={{ color: 'var(--color-risk-high)', marginLeft: '3px' }}>*</span>}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: '12px',
            color: focused ? 'var(--color-primary)' : 'var(--color-neutral-400)',
            display: 'flex', alignItems: 'center', pointerEvents: 'none',
            transition: 'color var(--transition-fast)',
          }}>
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={type === 'email' ? 'email' : type === 'password' ? 'current-password' : 'off'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: '42px',
            padding: `0 ${rightEl ? '44px' : '14px'} 0 ${icon ? '40px' : '14px'}`,
            border: `1.5px solid ${focused ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: focused ? '#fff' : 'var(--color-bg)',
            fontSize: '0.9375rem',
            color: 'var(--color-neutral-800)',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            boxShadow: focused ? '0 0 0 3px rgba(124,154,133,0.12)' : 'none',
            transition: 'all var(--transition-fast)',
          }}
        />
        {rightEl && (
          <span style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center' }}>
            {rightEl}
          </span>
        )}
      </div>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

/* ─── Icons ─────────────────────────────────────────────── */
const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);
const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

/* ─── Component ─────────────────────────────────────────── */
export default function Auth() {
  const { login, register, loginAsDemo, isAuthenticated, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [tab, setTab] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  // Login fields
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [name, setName]         = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPwd, setRegPwd]     = useState('');
  const [confirm, setConfirm]   = useState('');
  const [role, setRole]         = useState('Clinician');

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true });
  }, [isAuthenticated, navigate]);

  const switchTab = (t) => {
    setTab(t);
    setLocalError('');
    clearError();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (ok) navigate('/app', { replace: true });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (regPwd !== confirm) { setLocalError('Passwords do not match.'); return; }
    if (regPwd.length < 8) { setLocalError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    const ok = await register({ name, email: regEmail, password: regPwd, role });
    setSubmitting(false);
    if (ok) navigate('/app', { replace: true });
  };

  const handleDemo = async () => {
    setSubmitting(true);
    await loginAsDemo();
    setSubmitting(false);
  };

  const displayError = localError || error;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      backgroundImage: `
        radial-gradient(circle at 25% 25%, rgba(124,154,133,0.07) 0%, transparent 45%),
        radial-gradient(circle at 75% 75%, rgba(138,129,120,0.05) 0%, transparent 40%)
      `,
    }}>

      {/* Back to home */}
      <Link to="/" style={{
        position: 'absolute', top: '24px', left: '32px',
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '0.8125rem', color: 'var(--color-neutral-500)',
        textDecoration: 'none', fontWeight: 500,
        transition: 'color var(--transition-fast)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        NeuroSense
      </Link>

      {/* Auth card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
      }}>

        {/* Card header */}
        <div style={{
          padding: '32px 36px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          {/* Logo */}
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(140deg, #7C9A85, #5E7A67)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '20px', fontWeight: 700,
            boxShadow: '0 4px 14px rgba(124,154,133,0.35)',
            marginBottom: '4px',
          }}>N</div>

          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.025em', margin: 0 }}>
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-400)', marginTop: '6px' }}>
              {tab === 'login' ? 'Sign in to NeuroSense Clinical Intelligence' : 'Start screening with explainable AI'}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: 'flex',
            width: '100%',
            backgroundColor: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg)',
            padding: '3px',
            gap: '2px',
            marginTop: '4px',
          }}>
            {['login', 'register'].map((t) => (
              <button
                key={t}
                id={`auth-tab-${t}`}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  height: '34px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: tab === t ? 'var(--color-bg-card)' : 'transparent',
                  color: tab === t ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
                  fontSize: '0.8125rem',
                  fontWeight: tab === t ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all var(--transition-fast)',
                  boxShadow: tab === t ? 'var(--shadow-xs)' : 'none',
                  textTransform: 'capitalize',
                }}
                aria-selected={tab === t}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
        </div>

        {/* Form body */}
        <div style={{ padding: '24px 36px 32px' }}>

          {/* Error banner */}
          {displayError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-risk-high-muted)',
              border: '1px solid var(--color-risk-high-border)',
              marginBottom: '16px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-risk-high)" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-risk-high)', fontWeight: 500 }}>{displayError}</span>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field
                id="login-email" label="Email address" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org" icon={<MailIcon />}
              />
              <Field
                id="login-password" label="Password" type={showPwd ? 'text' : 'password'} required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" icon={<LockIcon />}
                rightEl={
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', padding: 0 }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}>
                    <EyeIcon open={showPwd} />
                  </button>
                }
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <a href="#" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={submitting || isLoading}
                style={{
                  height: '44px', borderRadius: 'var(--radius-lg)', border: 'none',
                  background: 'linear-gradient(135deg, #7C9A85, #5E7A67)',
                  color: '#fff', fontSize: '0.9375rem', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  boxShadow: '0 4px 14px rgba(124,154,133,0.35)',
                  opacity: submitting ? 0.75 : 1,
                  transition: 'all var(--transition-fast)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {submitting ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign In →'}
              </button>

              <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', textAlign: 'center' }}>
                Demo: <code style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-neutral-100)', padding: '1px 6px', borderRadius: '4px' }}>priya@neurosense.health</code> / <code style={{ fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-neutral-100)', padding: '1px 6px', borderRadius: '4px' }}>demo1234</code>
              </p>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Field
                id="reg-name" label="Full name" required
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Ananya Singh" icon={<UserIcon />}
              />
              <Field
                id="reg-email" label="Work email" type="email" required
                value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@hospital.org" icon={<MailIcon />}
              />

              {/* Role select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="reg-role" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-neutral-700)' }}>
                  Clinical role <span style={{ color: 'var(--color-risk-high)' }}>*</span>
                </label>
                <select
                  id="reg-role" value={role} onChange={(e) => setRole(e.target.value)}
                  style={{
                    height: '42px', padding: '0 14px',
                    border: '1.5px solid var(--color-neutral-200)',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-bg)',
                    fontSize: '0.9375rem', color: 'var(--color-neutral-800)',
                    fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer',
                  }}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <Field
                id="reg-password" label="Password" type={showPwd ? 'text' : 'password'} required
                value={regPwd} onChange={(e) => setRegPwd(e.target.value)}
                placeholder="Min. 8 characters" icon={<LockIcon />}
                hint="Use letters, numbers and symbols"
                rightEl={
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', padding: 0 }}
                    aria-label={showPwd ? 'Hide' : 'Show'}>
                    <EyeIcon open={showPwd} />
                  </button>
                }
              />
              <Field
                id="reg-confirm" label="Confirm password" type={showConfirm ? 'text' : 'password'} required
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password" icon={<LockIcon />}
                rightEl={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', padding: 0 }}
                    aria-label="Toggle confirm visibility">
                    <EyeIcon open={showConfirm} />
                  </button>
                }
              />

              <button
                id="register-submit-btn"
                type="submit"
                disabled={submitting}
                style={{
                  height: '44px', borderRadius: 'var(--radius-lg)', border: 'none',
                  background: 'linear-gradient(135deg, #7C9A85, #5E7A67)',
                  color: '#fff', fontSize: '0.9375rem', fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  boxShadow: '0 4px 14px rgba(124,154,133,0.35)',
                  opacity: submitting ? 0.75 : 1,
                  marginTop: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {submitting ? 'Creating account…' : 'Create Account →'}
              </button>

              <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', textAlign: 'center', lineHeight: 1.5 }}>
                By registering you agree to our{' '}
                <a href="#" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>Terms</a>
                {' '}and{' '}
                <a href="#" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>Privacy Policy</a>.
              </p>
            </form>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-neutral-200)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-400)', whiteSpace: 'nowrap' }}>or</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-neutral-200)' }} />
          </div>

          {/* Demo access */}
          <button
            id="demo-access-btn"
            onClick={handleDemo}
            disabled={submitting}
            style={{
              width: '100%', height: '42px',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid var(--color-neutral-200)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-neutral-700)',
              fontSize: '0.875rem', fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all var(--transition-fast)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Continue as Demo
          </button>
        </div>
      </div>

      {/* Compliance note */}
      <p style={{ marginTop: '20px', fontSize: '0.75rem', color: 'var(--color-neutral-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        Protected under DPDP Act 2023 · End-to-end encrypted
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
