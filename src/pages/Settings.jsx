/**
 * Settings.jsx
 * Application preferences and configuration panel.
 */

import React, { useState } from 'react';

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: '640px' },
  section: {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionHeader: {
    padding: 'var(--space-5) var(--space-6)',
    borderBottom: '1px solid var(--color-neutral-100)',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-900)',
  },
  sectionDesc: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-5) var(--space-6)',
    borderBottom: '1px solid var(--color-neutral-100)',
    gap: 'var(--space-6)',
  },
  settingInfo: { flex: 1 },
  settingLabel: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-neutral-800)',
  },
  settingHint: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-400)',
    marginTop: '3px',
  },
  toggle: (active) => ({
    position: 'relative',
    width: '42px',
    height: '24px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: active ? 'var(--color-primary)' : 'var(--color-neutral-300)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)',
    flexShrink: 0,
  }),
  toggleThumb: (active) => ({
    position: 'absolute',
    top: '3px',
    left: active ? '21px' : '3px',
    width: '18px',
    height: '18px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
    transition: 'left var(--transition-spring)',
  }),
  select: {
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-neutral-200)',
    backgroundColor: 'var(--color-bg)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-700)',
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: 'var(--space-3) var(--space-6)',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    boxShadow: 'var(--shadow-primary)',
    transition: 'all var(--transition-fast)',
  },
  dangerBtn: {
    padding: 'var(--space-3) var(--space-6)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-risk-high-border)',
    backgroundColor: 'var(--color-risk-high-muted)',
    color: 'var(--color-risk-high)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-semibold)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    transition: 'all var(--transition-fast)',
  },
  apiInput: {
    flex: 1,
    height: '36px',
    padding: '0 var(--space-3)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-bg)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-neutral-700)',
  },
};

function Toggle({ id, checked, onChange, label, hint }) {
  return (
    <div style={styles.settingRow} role="group" aria-labelledby={`${id}-label`}>
      <div style={styles.settingInfo}>
        <div id={`${id}-label`} style={styles.settingLabel}>{label}</div>
        {hint && <div style={styles.settingHint}>{hint}</div>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        style={styles.toggle(checked)}
        onClick={() => onChange(!checked)}
      >
        <span style={styles.toggleThumb(checked)} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Settings() {
  const [prefs, setPrefs] = useState({
    shapEnabled: true,
    autoFlag: true,
    emailNotifications: false,
    auditLog: true,
    highContrastMode: false,
    reducedMotion: false,
    defaultRiskThreshold: 'moderate',
    apiBase: 'http://localhost:8000',
  });

  const set = (key) => (val) => setPrefs((p) => ({ ...p, [key]: val }));

  return (
    <main id="settings-page" style={styles.page}>
      {/* Integrations */}
      <section style={styles.section} aria-label="API & Integrations">
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>API & Integrations</div>
          <div style={styles.sectionDesc}>Connect to the NeuroSense backend and external services.</div>
        </div>
        <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
          <div style={styles.settingInfo}>
            <div style={styles.settingLabel}>Backend API URL</div>
            <div style={styles.settingHint}>FastAPI server address</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flex: 1, maxWidth: '280px' }}>
            <input
              id="settings-api-url"
              type="url"
              value={prefs.apiBase}
              onChange={(e) => set('apiBase')(e.target.value)}
              style={styles.apiInput}
              aria-label="Backend API URL"
            />
          </div>
        </div>
      </section>

      {/* Clinical Preferences */}
      <section style={styles.section} aria-label="Clinical Preferences">
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Clinical Preferences</div>
          <div style={styles.sectionDesc}>Control how cases are flagged and reported.</div>
        </div>
        <Toggle id="toggle-shap" checked={prefs.shapEnabled} onChange={set('shapEnabled')} label="SHAP Explanations" hint="Show feature importance for every result" />
        <Toggle id="toggle-autoflag" checked={prefs.autoFlag} onChange={set('autoFlag')} label="Auto-Flag High Risk" hint="Automatically mark cases above threshold" />
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}>
            <div style={styles.settingLabel}>Default Risk Threshold</div>
            <div style={styles.settingHint}>Cases at or above this level are flagged</div>
          </div>
          <select
            id="settings-risk-threshold"
            value={prefs.defaultRiskThreshold}
            onChange={(e) => set('defaultRiskThreshold')(e.target.value)}
            style={styles.select}
            aria-label="Default risk threshold"
          >
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </div>
        <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
          <Toggle id="toggle-audit" checked={prefs.auditLog} onChange={set('auditLog')} label="Audit Logging" hint="Record all clinical actions for compliance" />
        </div>
      </section>

      {/* Notifications */}
      <section style={styles.section} aria-label="Notifications">
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Notifications</div>
          <div style={styles.sectionDesc}>Configure how you receive alerts.</div>
        </div>
        <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
          <Toggle id="toggle-email" checked={prefs.emailNotifications} onChange={set('emailNotifications')} label="Email Notifications" hint="Receive alerts for high-risk cases via email" />
        </div>
      </section>

      {/* Accessibility */}
      <section style={styles.section} aria-label="Accessibility">
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitle}>Accessibility</div>
          <div style={styles.sectionDesc}>Adapt the interface to your needs.</div>
        </div>
        <Toggle id="toggle-contrast" checked={prefs.highContrastMode} onChange={set('highContrastMode')} label="High Contrast Mode" hint="Increase color contrast for visibility" />
        <div style={{ ...styles.settingRow, borderBottom: 'none' }}>
          <Toggle id="toggle-motion" checked={prefs.reducedMotion} onChange={set('reducedMotion')} label="Reduce Motion" hint="Minimize animations and transitions" />
        </div>
      </section>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <button id="settings-save-btn" style={styles.saveBtn} onClick={() => alert('Settings saved (demo)')}>
          Save Preferences
        </button>
        <button id="settings-reset-btn" style={styles.dangerBtn} onClick={() => alert('Reset to defaults (demo)')}>
          Reset to Defaults
        </button>
      </div>
    </main>
  );
}
