/**
 * Settings.jsx — Upgraded: profile card, grouped settings panels, danger zone.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Toggle ──────────────────────────────────────────────── */
function Toggle({ id, checked, onChange, label, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '14px 0' }}>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-neutral-800)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.8125rem', color: 'var(--color-neutral-400)', marginTop: '3px', lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          width: '42px', height: '24px', borderRadius: '999px', border: 'none',
          backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-neutral-300)',
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background-color 200ms',
        }}
      >
        <span style={{
          position: 'absolute', top: '3px',
          left: checked ? '21px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left 200ms',
          display: 'block',
        }} />
      </button>
    </div>
  );
}

/* ── Section card ────────────────────────────────────────── */
function Section({ title, icon, children, danger }) {
  return (
    <section style={{
      backgroundColor: 'var(--color-bg-card)',
      border: `1px solid ${danger ? 'var(--color-risk-high-border)' : 'var(--color-neutral-200)'}`,
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        padding: '16px 22px',
        borderBottom: `1px solid ${danger ? 'var(--color-risk-high-border)' : 'var(--color-neutral-100)'}`,
        backgroundColor: danger ? 'var(--color-risk-high-muted)' : 'var(--color-bg)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', color: danger ? 'var(--color-risk-high)' : 'var(--color-neutral-500)', flexShrink: 0 }}>{icon}</div>
        <h2 style={{
          fontSize: '0.9rem', fontWeight: 600,
          color: danger ? 'var(--color-risk-high)' : 'var(--color-neutral-800)',
          margin: 0,
        }}>{title}</h2>
      </div>
      <div style={{ padding: '6px 22px 18px', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </section>
  );
}

/* ── Labelled input ──────────────────────────────────────── */
function LabelledInput({ id, label, value, onChange, mono, desc, type = 'text' }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--color-neutral-100)' }}>
      <label htmlFor={id} style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-neutral-700)', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      {desc && <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-400)', margin: '0 0 8px', lineHeight: 1.4 }}>{desc}</p>}
      <input
        id={id} type={type} value={value} onChange={onChange}
        onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{
          width: '100%', height: '40px', padding: '0 14px',
          border: `1.5px solid ${foc ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
          borderRadius: '10px',
          backgroundColor: foc ? '#fff' : 'var(--color-bg)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          fontSize: '0.9rem', color: 'var(--color-neutral-800)', outline: 'none',
          boxShadow: foc ? '0 0 0 3px rgba(124,154,133,0.12)' : 'none',
          transition: 'all 150ms',
        }}
      />
    </div>
  );
}

function initials(name) {
  return (name ?? '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Settings() {
  const { user, logout } = useAuth();

  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [timeoutVal, setTimeoutVal] = useState('30');
  const [riskThreshold, setRiskThreshold] = useState('0.6');
  const [toggls, setToggls] = useState({
    autoSave: true, notifications: true, auditLog: true, reducedMotion: false,
    highContrast: false, emailAlerts: false, xaiDefault: true,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key) => setToggls((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <main id="settings-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '720px' }}>

      {/* Profile card */}
      <section style={{
        background: 'linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
        borderRadius: '16px', padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: '18px',
        boxShadow: '0 4px 24px rgba(94,122,103,0.25)',
      }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
          backgroundColor: 'rgba(255,255,255,0.2)',
          border: '2px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.375rem', fontWeight: 700, color: '#fff',
        }}>{initials(user?.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff' }}>{user?.name ?? 'Clinician'}</div>
          <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>{user?.role ?? ''}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{user?.email ?? ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          <span style={{
            padding: '3px 10px', borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            fontSize: '0.75rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7CDE9A', flexShrink: 0 }} />
            Active
          </span>
          <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            Member since {user?.joinedAt ?? '—'}
          </span>
        </div>
      </section>

      {/* API & Integrations */}
      <Section title="API & Integrations" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}>
        <LabelledInput id="api-base-url" label="Backend API URL" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} mono desc="NeuroSense connects to this endpoint for live inference and data sync." />
        <LabelledInput id="api-timeout" label="Request Timeout (seconds)" value={timeoutVal} onChange={(e) => setTimeoutVal(e.target.value)} type="number" />
        <div style={{ padding: '14px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button id="test-connection-btn" style={{
            padding: '8px 18px', borderRadius: '8px', border: '1px solid var(--color-primary)',
            backgroundColor: 'transparent', color: 'var(--color-primary-dark)',
            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>Test Connection</button>
          <button id="reset-api-btn" style={{
            padding: '8px 18px', borderRadius: '8px',
            border: '1px solid var(--color-neutral-200)',
            backgroundColor: 'transparent', color: 'var(--color-neutral-500)',
            fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>Reset to Default</button>
        </div>
      </Section>

      {/* Clinical preferences */}
      <Section title="Clinical Preferences" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3"/><path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/></svg>}>
        <Toggle id="toggle-xai-default" checked={toggls.xaiDefault} onChange={() => toggle('xaiDefault')}
          label="Show XAI explanations by default"
          desc="Automatically display SHAP feature importances on every result." />
        <div style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
          <div style={{ padding: '14px 0 8px' }}>
            <label htmlFor="risk-threshold-select" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-neutral-700)', display: 'block', marginBottom: '6px' }}>Default High-Risk Threshold</label>
            <select id="risk-threshold-select" value={riskThreshold} onChange={(e) => setRiskThreshold(e.target.value)}
              style={{
                height: '40px', padding: '0 14px',
                border: '1.5px solid var(--color-neutral-200)', borderRadius: '10px',
                backgroundColor: 'var(--color-bg)', fontSize: '0.9rem',
                fontFamily: 'var(--font-body)', color: 'var(--color-neutral-700)', cursor: 'pointer',
              }}>
              {['0.50', '0.55', '0.60', '0.65', '0.70', '0.75', '0.80'].map((v) => (
                <option key={v} value={v}>{(parseFloat(v) * 100).toFixed(0)}% — {parseFloat(v) >= 0.7 ? 'Conservative' : parseFloat(v) <= 0.55 ? 'Sensitive' : 'Balanced'}</option>
              ))}
            </select>
          </div>
        </div>
        <Toggle id="toggle-auto-save" checked={toggls.autoSave} onChange={() => toggle('autoSave')}
          label="Auto-save sessions" desc="Automatically save incomplete screening sessions every 60 seconds." />
        <Toggle id="toggle-audit-log" checked={toggls.auditLog} onChange={() => toggle('auditLog')}
          label="Enable audit logging" desc="Log all case access and modifications (required for DPDP compliance)." />
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}>
        <Toggle id="toggle-notifications" checked={toggls.notifications} onChange={() => toggle('notifications')}
          label="In-app notifications" desc="Show banner alerts for high-risk case flags and pending reviews." />
        <Toggle id="toggle-email-alerts" checked={toggls.emailAlerts} onChange={() => toggle('emailAlerts')}
          label="Email alerts for high-risk cases" desc="Receive an email when a new high-risk case is flagged for your review." />
      </Section>

      {/* Accessibility */}
      <Section title="Accessibility" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="2"/><path d="M9 9h6M12 9v11M9 12l-3 4M15 12l3 4"/></svg>}>
        <Toggle id="toggle-reduced-motion" checked={toggls.reducedMotion} onChange={() => toggle('reducedMotion')}
          label="Reduce motion" desc="Minimises animations and transitions across the interface." />
        <Toggle id="toggle-high-contrast" checked={toggls.highContrast} onChange={() => toggle('highContrast')}
          label="High contrast mode" desc="Increases colour contrast for improved readability." />
      </Section>

      {/* Save button */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button id="save-settings-btn" onClick={handleSave} style={{
          padding: '10px 28px', borderRadius: '10px', border: 'none',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
          color: '#fff', fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: '0.9375rem',
          boxShadow: '0 4px 14px rgba(124,154,133,0.30)',
        }}>Save Changes</button>
        {saved && (
          <span style={{
            fontSize: '0.875rem', color: 'var(--color-primary-dark)', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved successfully
          </span>
        )}
      </div>

      {/* Danger zone */}
      <Section title="Danger Zone" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} danger>
        <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--color-risk-high-border)' }}>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--color-neutral-800)', fontSize: '0.9rem' }}>Clear All Mock Data</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-neutral-400)', marginTop: '2px' }}>Remove all demo cases and screening sessions</div>
          </div>
          <button id="clear-data-btn" style={{
            padding: '7px 16px', borderRadius: '8px',
            border: '1px solid var(--color-risk-high-border)',
            backgroundColor: 'transparent', color: 'var(--color-risk-high)',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>Clear Data</button>
        </div>
        <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: 500, color: 'var(--color-neutral-800)', fontSize: '0.9rem' }}>Sign Out</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-neutral-400)', marginTop: '2px' }}>End your current session and return to login</div>
          </div>
          <button id="settings-logout-btn" onClick={logout} style={{
            padding: '7px 16px', borderRadius: '8px',
            border: '1px solid var(--color-risk-high-border)',
            backgroundColor: 'var(--color-risk-high-muted)', color: 'var(--color-risk-high)',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>Sign Out</button>
        </div>
      </Section>
    </main>
  );
}
