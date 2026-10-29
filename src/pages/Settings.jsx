/**
 * Settings.jsx - only controls and facts that are real.
 *   Account      : from the authenticated session (GET /auth/me via AuthContext).
 *   Backend      : live status from GET / (version, database connection, per-modality status).
 *   This device  : clinician notes are kept in this browser only (they are not sent to the server).
 * Former preference toggles (API URL, risk threshold, notifications, e-mail alerts, audit log...) were removed:
 * nothing in the application read them, so they only gave a false impression of configurability.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { healthApi } from '../services/api';

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--color-neutral-100)', fontSize: '0.88rem' }}>
      <span style={{ color: 'var(--color-neutral-500)' }}>{k}</span>
      <strong style={{ textAlign: 'right', color: 'var(--color-neutral-800)' }}>{v}</strong>
    </div>
  );
}

function Panel({ title, children, labelId }) {
  return (
    <section aria-labelledby={labelId} className="panel" style={{ marginBottom: 20 }}>
      <h2 id={labelId} style={{ fontSize: '1.05rem', marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState({ loading: true });
  const [notesCleared, setNotesCleared] = useState(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    healthApi.get().then(
      (data) => active && setHealth({ data }),
      (error) => active && setHealth({ error: error?.message || 'Backend unreachable' }),
    );
    return () => { active = false; };
  }, [reload]);
  const refresh = () => { setHealth({ loading: true }); setReload((n) => n + 1); };

  const clearNotes = () => {
    if (!window.confirm('Delete the clinician notes stored in this browser? This cannot be undone.')) return;
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('ns_notes_'));
    keys.forEach((k) => localStorage.removeItem(k));
    setNotesCleared(keys.length);
  };

  const m = health.data?.modalities;
  return (
    <main id="settings-page" style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <h1 style={{ marginBottom: 6 }}>Settings</h1>
      <p style={{ color: 'var(--color-neutral-500)', marginBottom: 24 }}>Account details and live system status. NeuroSense is a screening aid, not a diagnostic tool.</p>

      <Panel title="Account" labelId="settings-account">
        <Row k="Name" v={user?.name ?? '—'} />
        <Row k="Email" v={user?.email ?? '—'} />
        <Row k="Role" v={user?.role ?? '—'} />
        <div style={{ marginTop: 14 }}>
          <button id="settings-logout-btn" type="button" className="btn btn-secondary"
            onClick={() => { if (window.confirm('Sign out of NeuroSense?')) logout(); }}>Sign out</button>
        </div>
      </Panel>

      <Panel title="System status" labelId="settings-status">
        {health.loading && <p role="status">Checking the backend…</p>}
        {health.error && (
          <p role="alert" style={{ color: 'var(--color-risk-high)' }}>
            The backend could not be reached: {health.error}
          </p>
        )}
        {health.data && (
          <>
            <Row k="API version" v={health.data.version} />
            <Row k="Overall" v={health.data.status} />
            <Row k="Database" v={health.data.database?.connected ? 'connected' : 'not connected'} />
            <Row k="Questionnaire ML models" v={Object.entries(health.data.modelsLoaded || {}).map(([c, ok]) => `${c}: ${ok ? 'loaded' : 'not loaded'}`).join(' · ') || '—'} />
            <Row k="Questionnaire" v="scoring rule drives the result; ML model is explanation only; not clinically validated" />
            <Row k="Eye gaze" v={m ? `${m.gaze.status.replace(/_/g, ' ')} · OpenFace ${m.gaze.openface_available ? 'installed' : 'not installed'} · not in result` : '—'} />
            <Row k="Speech" v={m ? `${m.speech.status.replace(/_/g, ' ')} · measurements only` : '—'} />
            <Row k="Facial" v={m ? `${m.facial.status.replace(/_/g, ' ')} · face detection only` : '—'} />
            <Row k="Result basis" v={m?.result?.basis?.replace(/_/g, ' ') ?? '—'} />
          </>
        )}
        <div style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary" onClick={refresh}>Refresh status</button></div>
      </Panel>

      <Panel title="This device" labelId="settings-device">
        <p style={{ margin: '0 0 12px', color: 'var(--color-neutral-600)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Clinician notes on the results page are saved only in this browser. They are not sent to or stored by the server.
        </p>
        <button type="button" className="btn btn-secondary" onClick={clearNotes}>Delete notes stored in this browser</button>
        {notesCleared !== null && <p role="status" style={{ marginTop: 10, fontSize: '0.85rem' }}>{notesCleared} note(s) removed.</p>}
      </Panel>
    </main>
  );
}
