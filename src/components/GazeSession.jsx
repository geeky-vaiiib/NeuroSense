import { useCallback, useEffect, useRef, useState } from 'react';
import GazeVisualizer from './screening/GazeVisualizer';
import { gazeApi } from '../services/api';
import { FaceTracker, TrackerError, LOW_LIGHT } from '../gaze/tracker';
import { FACE_REASONS } from '../gaze/landmarks';

/* ──────────────────────────────────────────────────────────────
   SVG Stimulus Faces — five simple variants
   ────────────────────────────────────────────────────────────── */
const STIMULI = [
  { id: 0, key: 'happy_face', label: 'Happy face', mouth: 'smile', eyeDir: 'center', bg: '#FFD97D' },
  { id: 1, key: 'neutral_face', label: 'Neutral face', mouth: 'flat', eyeDir: 'center', bg: '#A8D8EA' },
  { id: 2, key: 'looking_away_face', label: 'Looking-away face', mouth: 'flat', eyeDir: 'right', bg: '#C3B1E1' },
  { id: 3, key: 'no_eye_contact_face', label: 'No-eye-contact face', mouth: 'flat', eyeDir: 'down', bg: '#F8B4B4' },
  { id: 4, key: 'crowd_scene', label: 'Crowd scene (abstract)', mouth: 'crowd', eyeDir: 'center', bg: '#B5EAD7' },
];

function StimulusSVG({ stimulus }) {
  const { mouth, eyeDir, bg } = stimulus;

  if (mouth === 'crowd') {
    // Abstract crowd: 5 small head circles
    const heads = [
      { cx: 60, cy: 90 }, { cx: 120, cy: 70 }, { cx: 180, cy: 85 },
      { cx: 240, cy: 75 }, { cx: 300, cy: 90 },
    ];
    return (
      <svg viewBox="0 0 360 200" width="360" height="200" role="img" aria-label={stimulus.label}>
        <rect width="360" height="200" rx="20" fill={bg} />
        {heads.map((h, i) => (
          <g key={i}>
            <circle cx={h.cx} cy={h.cy} r="28" fill="#fff" stroke="#555" strokeWidth="2" />
            <circle cx={h.cx - 8} cy={h.cy - 5} r="3" fill="#333" />
            <circle cx={h.cx + 8} cy={h.cy - 5} r="3" fill="#333" />
            <circle cx={h.cx} cy={h.cy + 3} r="2" fill="#888" />
            <path d={`M${h.cx - 7} ${h.cy + 10} Q${h.cx} ${h.cy + 16} ${h.cx + 7} ${h.cy + 10}`} stroke="#555" strokeWidth="2" fill="none" />
          </g>
        ))}
      </svg>
    );
  }

  // Eye pupil offsets
  const pupilOffset = eyeDir === 'right' ? 6 : eyeDir === 'down' ? 0 : 0;
  const pupilYOffset = eyeDir === 'down' ? 6 : 0;
  const eyeVisible = eyeDir !== 'down'; // for no-eye-contact, pupils look down/hidden

  // Mouth path
  let mouthPath;
  if (mouth === 'smile') {
    mouthPath = <path d="M70 130 Q100 160 130 130" stroke="#555" strokeWidth="3" fill="none" strokeLinecap="round" />;
  } else {
    mouthPath = <line x1="75" y1="130" x2="125" y2="130" stroke="#555" strokeWidth="3" strokeLinecap="round" />;
  }

  return (
    <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label={stimulus.label}>
      <circle cx="100" cy="100" r="90" fill={bg} stroke="#555" strokeWidth="2" />
      {/* Left eye */}
      <circle cx="75" cy="85" r="12" fill="#fff" stroke="#555" strokeWidth="1.5" />
      <circle cx={75 + pupilOffset} cy={85 + pupilYOffset} r={eyeVisible ? 5 : 3} fill="#333" />
      {/* Right eye */}
      <circle cx="125" cy="85" r="12" fill="#fff" stroke="#555" strokeWidth="1.5" />
      <circle cx={125 + pupilOffset} cy={85 + pupilYOffset} r={eyeVisible ? 5 : 3} fill="#333" />
      {/* Nose */}
      <circle cx="100" cy="108" r="3" fill="#888" />
      {/* Mouth */}
      {mouthPath}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Shared inline-style helpers (match NeuroSense card aesthetic)
   ────────────────────────────────────────────────────────────── */
const card = {
  backgroundColor: 'var(--color-bg-card)',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: 'var(--shadow-xs)',
};

const primaryBtn = {
  minHeight: '46px',
  padding: '0 24px',
  borderRadius: '12px',
  border: 'none',
  background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
  color: '#fff',
  fontSize: '0.95rem',
  fontWeight: 700,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(26,26,24,0.10)',
};

const ghostBtn = {
  minHeight: '44px',
  padding: '0 18px',
  borderRadius: '12px',
  border: '1px solid var(--color-neutral-200)',
  backgroundColor: '#fff',
  color: 'var(--color-neutral-700)',
  fontSize: '0.95rem',
  fontWeight: 600,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
};

const skipText = {
  background: 'none', border: 'none', padding: '10px 4px', cursor: 'pointer',
  color: 'var(--color-neutral-500)', fontSize: '0.85rem', fontWeight: 600,
  textDecoration: 'underline', fontFamily: 'var(--font-body)',
};
const skipLink = {
  position: 'absolute',
  top: '16px',
  right: '16px',
  background: 'none',
  border: 'none',
  color: 'var(--color-neutral-500)',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  padding: '6px 10px',
  borderRadius: '8px',
};

/* ──────────────────────────────────────────────────────────────
   Task constants.  The browser only records video and shows the task.
   Gaze features come from OpenFace on the server — the same pipeline used to train the model —
   so there is no on-screen calibration; the setup step checks face visibility, position, distance
   and lighting only.  Results are available after the recording is processed.
   ────────────────────────────────────────────────────────────── */
const TASK_MS = 30_000;
const STIMULUS_MS = 6000;
const STABLE_MS = 1200;                  // face must be OK this long before the task can start
const MIME_CANDIDATES = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

const sessionId = () => (globalThis.crypto?.randomUUID?.() || `s-${Date.now()}`).slice(0, 36);
const nowMs = () => performance.now();

const STAGE_TEXT = {
  uploading: 'Uploading recording',
  uploaded: 'Recording received',
  normalizing_video: 'Processing video',
  extracting_gaze_features: 'Extracting gaze features (OpenFace)',
  running_model: 'Running the gaze model',
  complete: 'Generating result',
};

const GUIDANCE = {
  [FACE_REASONS.NO_LANDMARKS]: 'Make sure the face is visible and facing the screen.',
  [FACE_REASONS.INCOMPLETE]: 'Face the camera directly.',
  [FACE_REASONS.TOO_FAR]: 'Move closer to the camera.',
  [FACE_REASONS.TOO_CLOSE]: 'Move back a little from the camera.',
  [FACE_REASONS.OFF_CENTER]: 'Center the face in the frame.',
  LOW_LIGHT: 'Increase the lighting: face a window or lamp.',
};

const REASON_TEXT = {
  face_not_detected: 'A face was not detected in most of the recording.',
  low_tracking_confidence: 'Face tracking confidence was too low (lighting, distance or angle).',
  too_many_invalid_frames: 'Too many frames could not be tracked.',
  recording_too_short: 'The recording was too short to analyse.',
  too_few_usable_windows: 'Too little continuous, well-tracked footage was recorded.',
  tracking_not_continuous: 'Tracking was interrupted too often.',
  corrupt_video: 'The recording could not be read.',
  openface_unavailable: 'The OpenFace service is not installed on the server.',
  openface_failed: 'The server could not extract gaze features from the recording.',
  model_unavailable: 'The gaze model is not available on the server.',
};
const reasonText = (r) => REASON_TEXT[r] || (r ? `Reason: ${r}` : 'Unknown reason.');

function Check({ ok, label, hint }) {
  const color = ok === null ? '#8FA3C0' : ok ? '#22D3EE' : '#F8B4B4';
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#E6ECF5', fontSize: '0.92rem' }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontWeight: 600, minWidth: 74 }}>{label}</span>
      <span style={{ color: '#9FB0C8', fontSize: '0.82rem' }}>{ok === null ? '…' : ok ? 'OK' : hint}</span>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────
   Props:
     onComplete(session, analysis) — analysis is the backend result; session = { analysisId }
     onSkip(reason) — only from an explicit user choice (or an unavailable service)
   ────────────────────────────────────────────────────────────── */
export default function GazeSession({ onComplete, onSkip, category }) {
  const [phase, setPhase] = useState('intro'); // intro|setup|countdown|task|processing|result|error
  const [status, setStatus] = useState({ checking: true });
  const [camera, setCamera] = useState('idle');
  const [face, setFace] = useState({ ok: null, reason: null, fps: 0, luma: null });
  const [stableOk, setStableOk] = useState(false);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [stimulus, setStimulus] = useState(0);
  const [stage, setStage] = useState('uploading');
  const [analysis, setAnalysis] = useState(null);
  const [fault, setFault] = useState(null);
  const [setupNonce, setSetupNonce] = useState(0);

  const videoRef = useRef(null);
  const trackerRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const okSinceRef = useRef(null);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const idRef = useRef(sessionId());

  const clearTimers = () => { timersRef.current.forEach((t) => { clearInterval(t); clearTimeout(t); }); timersRef.current = []; };
  const stopTracker = useCallback(() => { trackerRef.current?.stop(); trackerRef.current = null; setCamera('idle'); }, []);

  const loadStatus = useCallback(() => {
    gazeApi.status().then(
      (st) => mountedRef.current && setStatus({ checking: false, available: Boolean(st.available && st.openface_available), model: st.available, openface: st.openface_available, version: st.model_version }),
      () => mountedRef.current && setStatus({ checking: false, available: null }),
    );
  }, []);
  const checkStatus = () => { setStatus({ checking: true }); loadStatus(); };

  useEffect(() => {
    mountedRef.current = true;
    loadStatus();
    return () => {
      mountedRef.current = false;
      clearTimers();
      try { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); } catch { /* already stopped */ }
      stopTracker();
    };
  }, [loadStatus, stopTracker]);

  const fail = useCallback((code, message) => { clearTimers(); setFault({ code, message }); setPhase('error'); }, []);

  // Camera/face tracking starts after the setup view (and its <video>) has been committed.
  const startSetup = () => {
    setFault(null); setStableOk(false); okSinceRef.current = null; setCamera('initializing');
    stopTracker(); setPhase('setup'); setSetupNonce((n) => n + 1);
  };

  useEffect(() => {
    if (!setupNonce || !videoRef.current) return undefined;
    let cancelled = false;
    const tr = new FaceTracker((f) => {
      if (!mountedRef.current || cancelled) return;
      setFace({ ok: f.ok, reason: f.reason, fps: f.fps, luma: f.luma });
      const good = f.ok && !(f.luma != null && f.luma < LOW_LIGHT);
      if (!good) { okSinceRef.current = null; setStableOk(false); return; }
      okSinceRef.current = okSinceRef.current ?? nowMs();
      if (nowMs() - okSinceRef.current >= STABLE_MS) setStableOk(true);
    });
    trackerRef.current = tr;
    tr.start(videoRef.current).then(() => { if (!cancelled && mountedRef.current) setCamera('ready'); }).catch((e) => {
      if (cancelled) return;
      stopTracker();
      fail(e instanceof TrackerError ? e.code : 'CAMERA_ERROR', e?.message || 'The camera could not be started.');
    });
    return () => { cancelled = true; };
  }, [setupNonce, fail, stopTracker]);

  // The preview <video> remounts between views; re-attach the shared camera stream after every commit.
  useEffect(() => {
    const v = videoRef.current; const st = trackerRef.current?.stream;
    if (!v || !st) return;
    if (v.srcObject !== st) v.srcObject = st;
    if (v.paused) v.play?.()?.catch?.(() => { /* muted autoplay normally allowed */ });
  });

  const upload = async (blob, durationMs) => {
    setPhase('processing'); setStage('uploading');
    try {
      const res = await gazeApi.analyze({ blob, durationMs, sessionId: idRef.current, onStage: (s) => mountedRef.current && setStage(s) });
      if (!mountedRef.current) return;
      setAnalysis(res); setPhase('result');
    } catch (e) {
      fail('GAZE_ANALYSIS_FAILED', e?.message || 'The recording could not be analysed.');
    }
  };

  const beginTask = () => {
    const stream = trackerRef.current?.stream;
    if (!stream || typeof MediaRecorder === 'undefined') { fail('RECORDING_UNSUPPORTED', 'This browser cannot record video. Use a recent Chrome, Edge or Firefox.'); return; }
    const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined); }
    catch (e) { fail('RECORDING_UNSUPPORTED', e?.message || 'Recording could not be started.'); return; }
    chunksRef.current = [];
    rec.ondataavailable = (ev) => { if (ev.data?.size) chunksRef.current.push(ev.data); };
    recorderRef.current = rec;
    setPhase('countdown'); setCount(3);
    let c = 3;
    const cd = setInterval(() => {
      c -= 1; setCount(c);
      if (c > 0) return;
      clearInterval(cd);
      const t0 = nowMs();
      rec.onstop = () => {
        const durationMs = nowMs() - t0;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' });
        stopTracker();
        if (mountedRef.current) upload(blob, durationMs);
      };
      rec.start(1000);
      setPhase('task'); setElapsed(0); setStimulus(0);
      const tick = setInterval(() => {
        const e = nowMs() - t0;
        setElapsed(Math.min(e, TASK_MS));
        setStimulus(Math.min(STIMULI.length - 1, Math.floor(e / STIMULUS_MS)));
        if (e >= TASK_MS) { clearInterval(tick); if (rec.state === 'recording') rec.stop(); }
      }, 200);
      timersRef.current.push(tick);
    }, 1000);
    timersRef.current.push(cd);
  };

  const handleSkip = (reason) => { clearTimers(); stopTracker(); onSkip(reason || 'user_skipped'); };
  const handleContinue = () => onComplete({ analysisId: analysis?.job_id || null }, analysis);

  /* ── render ── */
  const darkCard = { ...card, position: 'relative', background: 'var(--ns-navy-900)', color: '#E6ECF5', border: '1px solid rgba(148,163,184,0.16)' };
  const showVideo = phase === 'setup' || phase === 'countdown' || phase === 'task';
  const videoStyle = phase === 'task'
    ? { position: 'fixed', right: 24, bottom: 24, width: 150, borderRadius: 12, transform: 'scaleX(-1)', zIndex: 5 }
    : { width: '100%', maxWidth: 420, borderRadius: 14, background: '#000', transform: 'scaleX(-1)', display: showVideo ? 'block' : 'none' };
  const video = <video ref={videoRef} playsInline muted autoPlay aria-label="Camera preview" style={videoStyle} />;

  let body = null;
  if (phase === 'intro') {
    const blocked = status.available === false;
    body = (
      <section style={{ ...card, position: 'relative' }}>
        <div style={{ marginBottom: 18 }}><GazeVisualizer size={150} /></div>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Eye gaze session {category === 'child' ? '(child)' : ''}</h2>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7, maxWidth: 640, marginBottom: 6 }}>
          The camera records a <strong>30-second</strong> picture task. When it ends, the recording is sent to the NeuroSense server,
          where OpenFace measures gaze direction and head pose and the trained model produces a screening signal.
          The result is calculated <strong>after</strong> the recording, not live. The video is deleted as soon as it has been processed.
        </p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 18 }}>
          Sit about an arm&apos;s length from the screen in a well-lit room, face the screen, and keep the head fairly steady. There is no calibration step.
        </p>
        <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, marginBottom: 18,
          color: status.checking ? 'var(--ns-n500)' : blocked ? 'var(--ns-risk-high-text)' : 'var(--ns-risk-low-text)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
          {status.checking ? 'Checking the gaze service…'
            : blocked ? `Gaze analysis unavailable on the server — ${status.model === false ? 'model not loaded' : 'OpenFace is not installed'}`
            : status.available ? `Gaze model ready (${status.version})` : 'Could not verify the gaze service; the analysis step will report its status.'}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={startSetup} disabled={status.checking || blocked} style={{ ...primaryBtn, opacity: status.checking || blocked ? 0.5 : 1 }}>Start camera check</button>
          {blocked && <button type="button" onClick={checkStatus} style={ghostBtn}>Check again</button>}
          <button type="button" onClick={() => handleSkip(blocked ? 'service_unavailable' : 'user_skipped')} style={skipText}>
            {blocked ? 'Continue without gaze (service unavailable)' : 'Skip gaze step'}
          </button>
        </div>
      </section>
    );
  } else if (phase === 'setup') {
    const lowLight = face.luma != null && face.luma < LOW_LIGHT;
    const checks = [
      ['Camera', camera === 'ready' ? true : camera === 'initializing' ? null : false, 'not started'],
      ['Face', camera === 'ready' ? Boolean(face.ok) || face.reason === FACE_REASONS.BLINK : null, GUIDANCE[face.reason] || 'not detected yet'],
      ['Position', camera !== 'ready' || face.ok === null ? null : face.reason !== FACE_REASONS.OFF_CENTER, GUIDANCE[FACE_REASONS.OFF_CENTER]],
      ['Distance', camera !== 'ready' || face.ok === null ? null : face.reason !== FACE_REASONS.TOO_FAR && face.reason !== FACE_REASONS.TOO_CLOSE, face.reason === FACE_REASONS.TOO_CLOSE ? GUIDANCE[FACE_REASONS.TOO_CLOSE] : GUIDANCE[FACE_REASONS.TOO_FAR]],
      ['Lighting', face.luma == null ? null : !lowLight, GUIDANCE.LOW_LIGHT],
    ];
    const ready = camera === 'ready' && stableOk;
    body = (
      <section className="ns-dark" style={darkCard}>
        <button type="button" onClick={() => handleSkip('user_skipped')} style={{ ...skipLink, color: '#8FA3C0' }}>Skip this step →</button>
        <p className="ns-eyebrow ns-eyebrow--dark" role="status">{ready ? 'FACE DETECTED' : camera === 'ready' ? 'LOOKING FOR FACE' : 'STARTING CAMERA'}</p>
        <h2 style={{ marginTop: 8, marginBottom: 6 }}>Check your camera and face</h2>
        <p style={{ margin: '0 0 18px', color: '#9FB0C8', maxWidth: 'none' }}>{ready ? 'Face detected and steady. You can start the task.' : (GUIDANCE[face.reason] || 'Face the camera and keep still.')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 26 }}>
          <div>{video}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, alignContent: 'start' }} aria-label="Camera and face checks">
            {checks.map(([label, ok, hint]) => <Check key={label} ok={ok} label={label} hint={hint} />)}
          </ul>
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={beginTask} disabled={!ready} style={{ ...primaryBtn, opacity: ready ? 1 : 0.5 }}>Start the 30-second task</button>
          {!ready && <span style={{ fontSize: '0.82rem', color: '#8FA3C0' }}>Enabled once the face is detected and steady.</span>}
        </div>
      </section>
    );
  } else if (phase === 'countdown' || phase === 'task') {
    const stim = STIMULI[stimulus] || STIMULI[0];
    const secs = Math.floor(elapsed / 1000);
    const mm = (s) => `00:${String(s).padStart(2, '0')}`;
    body = (
      <section className="ns-dark" style={{ position: 'relative', background: 'var(--ns-navy-900)', borderRadius: 20, minHeight: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, userSelect: 'none' }}>
        {phase === 'countdown' ? (
          <>
            <p style={{ color: '#9FB0C8', fontWeight: 600 }}>Get ready — recording starts in</p>
            <p role="timer" style={{ color: '#F4F7FB', fontSize: '4rem', fontWeight: 700, margin: 0 }}>{count}</p>
            <div style={{ marginTop: 16 }}>{video}</div>
          </>
        ) : (
          <>
            <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-data)', fontSize: '0.74rem', letterSpacing: '0.08em', color: '#9FB0C8' }}>
              <span role="timer" aria-label={`${secs} of 30 seconds`} style={{ color: '#F4F7FB', fontSize: '1.05rem', fontWeight: 600 }}>{mm(secs)} / 00:30</span>
              <span role="status" style={{ color: '#F87171' }}>● RECORDING</span>
            </div>
            <p style={{ color: 'var(--color-neutral-400)', fontSize: '0.85rem', marginBottom: 24, fontWeight: 600 }}>Picture {stimulus + 1} / {STIMULI.length}</p>
            <div style={{ marginBottom: 20 }}><StimulusSVG stimulus={stim} /></div>
            <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.82rem', marginTop: 16 }}>Just look at the pictures naturally. Results appear after the recording is processed.</p>
            {video}
          </>
        )}
      </section>
    );
  } else if (phase === 'processing') {
    body = (
      <section style={{ ...card, textAlign: 'center', padding: '56px 28px' }} role="status">
        <GazeVisualizer size={120} />
        <p style={{ color: 'var(--color-neutral-700)', fontWeight: 600, fontSize: '1.05rem', marginTop: 12 }}>Recording complete · {STAGE_TEXT[stage] || 'Processing'}…</p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.85rem', marginTop: 8 }}>
          The server is analysing the recording. This can take a minute; the video is deleted when processing ends.
        </p>
      </section>
    );
  } else if (phase === 'error' && fault) {
    body = (
      <section style={{ ...card, border: '1px solid var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
        <p className="ns-eyebrow" style={{ color: 'var(--color-risk-high)' }}>{fault.code}</p>
        <h3 style={{ marginTop: 6, color: 'var(--color-risk-high)', marginBottom: 10 }}>Gaze step problem</h3>
        <p role="alert" style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7, marginBottom: 20 }}>{fault.message}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={startSetup} style={primaryBtn}>Try again</button>
          <button type="button" onClick={() => handleSkip(fault.code.toLowerCase())} style={skipText}>Skip the gaze step (the report will say why)</button>
        </div>
      </section>
    );
  } else if (phase === 'result' && analysis) {
    const q = analysis.quality;
    if (analysis.status !== 'success') {
      const poor = analysis.status === 'insufficient_quality';
      body = (
        <section style={{ ...card, border: '1px solid var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
          <p className="ns-eyebrow" style={{ color: 'var(--color-risk-high)' }}>{analysis.error_code || 'UNAVAILABLE'}</p>
          <h3 style={{ marginTop: 6, color: 'var(--color-risk-high)' }}>{poor ? 'Recording quality too low' : 'Gaze analysis not available'}</h3>
          <p role="alert" style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
            {reasonText(analysis.reason)}{q ? ` (${q.valid_sample_count} of ${q.sample_count} frames usable, ${q.duration_seconds}s.)` : ''}
            {' '}Gaze will be reported as <strong>not available</strong>; it will not count as a low or high result.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
            {poor && <button type="button" onClick={startSetup} style={primaryBtn}>Repeat gaze test</button>}
            <button type="button" onClick={handleContinue} style={poor ? skipText : primaryBtn}>Continue (the report will show why gaze was not scored)</button>
          </div>
        </section>
      );
    } else {
      body = (
        <section style={card}>
          <p className="ns-eyebrow">ANALYZED</p>
          <h3 style={{ marginTop: 6, color: 'var(--color-neutral-900)' }}>Gaze recording analysed</h3>
          <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
            {q.valid_sample_count} of {q.sample_count} frames were usable over {q.duration_seconds}s (data quality {Math.round(q.data_quality_score * 100)}%).
            The gaze result appears with your final results.
          </p>
          <button type="button" onClick={handleContinue} style={primaryBtn}>Continue</button>
        </section>
      );
    }
  }
  return body;
}
