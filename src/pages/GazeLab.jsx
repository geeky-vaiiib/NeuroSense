/**
 * GazeLab.jsx — temporary page: record 30 s gaze sessions with the real NeuroSense flow, keep the
 * OpenFace feature CSVs (numbers only, never the video) and run the webcam domain check.
 * Passing the check is what allows the gaze model to count in the combined result.
 * Volunteer sessions here have no ASD/TD labels: they validate the pipeline, not clinical accuracy.
 */
import { useCallback, useEffect, useState } from 'react';
import GazeSession from '../components/GazeSession';
import { gazeApi } from '../services/api';

const MIN_SESSIONS = 10;
const box = { background: 'var(--color-bg-card)', border: '1px solid var(--color-neutral-200)', borderRadius: 16, padding: 20, marginBottom: 20 };
const btn = { minHeight: 40, padding: '0 16px', borderRadius: 10, border: '1px solid var(--color-neutral-200)', background: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' };

export default function GazeLab() {
  const [lab, setLab] = useState({ loading: true });
  const [run, setRun] = useState(0);        // remounts GazeSession for the next recording
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const refresh = useCallback(() => {
    gazeApi.labSessions().then(
      (d) => setLab({ loading: false, ...d }),
      (e) => setLab({ loading: false, error: e?.message || 'Gaze lab unavailable' }),
    );
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const validate = async () => {
    setBusy(true); setResult(null);
    try { setResult(await gazeApi.labValidate()); } catch (e) { setResult({ error: e?.message || 'Validation failed' }); }
    setBusy(false); refresh();
  };
  const clear = async () => { if (window.confirm('Delete all saved lab sessions?')) { await gazeApi.labClear(); setResult(null); refresh(); } };
  const again = () => { setRun((n) => n + 1); refresh(); };

  const good = (lab.sessions || []).filter((s) => s.quality_valid).length;
  const v = lab.validation;
  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ marginBottom: 6 }}>Gaze Lab</h1>
      <p style={{ color: 'var(--ns-n600)', lineHeight: 1.65, marginBottom: 20 }}>
        Temporary tool. Record the 30-second task a few times (different people, normal webcam, normal lighting). OpenFace runs on each
        recording and only the extracted numbers are kept — the video is deleted. When enough good sessions exist, run the check that
        checks whether their head/eye movement lies inside the range of the training recordings (children). Adults sitting still will normally fall outside it. Until it passes, the gaze result is shown but not counted in the final result.
        These recordings have no diagnosis labels, so this checks the pipeline, not accuracy.
      </p>

      <section style={box} aria-label="Validation status">
        {lab.loading ? <p>Loading…</p> : lab.error ? <p role="alert" style={{ color: 'var(--color-risk-high)' }}>{lab.error}</p> : (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>
              Webcam validation: {v?.passed ? <span style={{ color: 'var(--ns-risk-low-text)' }}>PASSED — gaze counts in fusion</span>
                : <span style={{ color: 'var(--ns-risk-mod-text)' }}>not passed{v?.reason ? ` (${v.reason})` : ''}</span>}
            </p>
            <p style={{ margin: '8px 0 14px', color: 'var(--ns-n600)', fontSize: '0.9rem' }}>
              Saved sessions: {lab.sessions.length} · good quality: {good} (need ≥ {MIN_SESSIONS} good sessions, ≥ 80% inside the training movement range)
            </p>
            {lab.sessions.length > 0 && (
              <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: '0.85rem', color: 'var(--ns-n700)' }}>
                {lab.sessions.map((s) => (
                  <li key={s.id}>{s.id.slice(0, 8)} · {s.duration_s}s · {s.quality_valid ? `quality ${Math.round(s.data_quality_score * 100)}%` : `rejected: ${s.reason}`}</li>
                ))}
              </ul>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={validate} disabled={busy || lab.sessions.length === 0}>{busy ? 'Checking…' : 'Run validation'}</button>
              <button type="button" style={btn} onClick={clear} disabled={lab.sessions.length === 0}>Clear sessions</button>
            </div>
            {result && (result.error ? <p role="alert" style={{ color: 'var(--color-risk-high)' }}>{result.error}</p> : (
              <div style={{ marginTop: 14, fontSize: '0.85rem' }}>
                <p style={{ fontWeight: 700, margin: '0 0 6px' }}>
                  {result.passed ? 'Passed' : 'Not passed'} — {result.n_quality_valid}/{result.n_sessions} good-quality · in range {result.domain_counts.in_domain} · marginal {result.domain_counts.marginal} · outside range {result.domain_counts.out_of_domain}
                </p>
                {result.sessions.map((x) => (
                  <div key={x.file} style={{ fontFamily: 'var(--font-data)' }}>
                    {x.file.slice(0, 8)}: {x.domain ? `${x.domain.status} (max |z| ${x.domain.max_abs_z}${x.domain.direction ? `, movement ${x.domain.direction} training range` : ''})` : `rejected: ${x.quality_reason}`}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </section>

      <GazeSession key={run} category="child" keepFeatures onComplete={again} onSkip={again} />
    </div>
  );
}
