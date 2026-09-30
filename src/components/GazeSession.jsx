import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GazeVisualizer from './screening/GazeVisualizer';
import { gazeApi } from '../services/api';
import ProgressIndicator from './ui/ProgressIndicator';
import { FaceTracker, TrackerError, LOW_LIGHT } from '../gaze/tracker';
import { FACE_REASONS, FEATURE_NAMES, OVERLAY_INDICES } from '../gaze/landmarks';
import { GazeSmoother } from '../gaze/filters';
import { fit, predict } from '../gaze/mapper';
import {
  COLLECT_MAX_MS, COLLECT_MS, MAX_ATTEMPTS, MAX_MEAN_ERR_FRAC, SETTLE_MS, STABLE_FRAMES, TARGETS, TARGET_FRAMES, assessCalibration,
} from '../gaze/calibration';

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
   Task / UI constants
   ────────────────────────────────────────────────────────────── */
const TASK_MS = 30_000;
const STIMULUS_MS = 6000;
const MIN_TASK_SAMPLES = 60;             // below this the session is "insufficient data", never sent
const OUT_OF_RANGE = 0.15;               // estimates may overshoot the screen edge by 15 % (then clamped); beyond that the sample is invalid
const STEPS = [
  { id: 'camera', label: 'Camera check' }, { id: 'face', label: 'Face detection' }, { id: 'calibration', label: 'Calibration' },
  { id: 'task', label: 'Visual task' }, { id: 'analysis', label: 'Analysis' }, { id: 'result', label: 'Result' },
];

// Wrapped so time reads inside event handlers are not flagged as render-time impurity.
const nowMs = () => performance.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEBUG_ENABLED = Boolean(import.meta.env?.DEV) && (() => {
  try { return new URLSearchParams(window.location.search).get('gazeDebug') === '1' || localStorage.getItem('ns_gaze_debug') === '1'; } catch { return false; }
})();

const GUIDANCE = {
  [FACE_REASONS.NO_LANDMARKS]: 'Make sure your face is visible and facing the screen.',
  [FACE_REASONS.INCOMPLETE]: 'Tracking is incomplete. Face the camera directly.',
  [FACE_REASONS.TOO_FAR]: 'Move closer to the camera.',
  [FACE_REASONS.TOO_CLOSE]: 'Move back a little from the camera.',
  [FACE_REASONS.OFF_CENTER]: 'Center your face in the frame.',
  LOW_LIGHT: 'Increase the lighting: face a window or lamp.',
};

const REASON_TEXT = {
  calibration_incomplete: 'Calibration was not completed.',
  poor_calibration: 'Eye-tracking calibration was not accurate enough.',
  insufficient_samples: 'Too few gaze samples were recorded.',
  insufficient_valid_samples: 'Too many gaze samples were unusable (off-screen or lost).',
  insufficient_usable_duration: 'Not enough continuous gaze data was recorded.',
  face_not_detected: 'Your face was not detected for much of the session.',
  inconsistent_timestamps: 'The recording timing was inconsistent.',
  session_too_long: 'The session ran longer than expected.',
  category_not_supported: 'The gaze model is only available for the child screening track.',
  no_compatible_checkpoint: 'The gaze model is not installed on the server.',
  torch_not_installed: 'The server is missing the deep-learning library the gaze model needs (torch).',
  requires_unavailable_feature: 'The installed gaze model needs data a browser cannot provide.',
  preprocess_config_mismatch: 'The installed gaze model does not match the current pipeline.',
  inference_failed: 'The gaze model failed while analysing this session.',
};
const reasonText = (r) => REASON_TEXT[r] || (r ? `Reason: ${r}` : 'Unknown reason.');

// ApiError.kind (services/api.js) -> fault key shown by this component
const GAZE_FAULT_BY_API_KIND = {
  network: 'backend_unavailable', timeout: 'backend_timeout', validation: 'invalid_payload',
  server: 'server_error', invalid_response: 'invalid_response', unauthenticated: 'session_expired', forbidden: 'server_error',
};

const FAULT_TITLES = {
  session_expired: 'Session expired',
  camera_permission_denied: 'Camera permission denied',
  no_camera: 'No camera found',
  camera_in_use: 'Camera is in use',
  camera_error: 'Camera problem',
  insecure_context: 'Camera needs a secure connection',
  video_not_ready: 'Camera is not producing video',
  face_model_load_failed: 'Face-tracking model could not load',
  face_not_detected: 'Face not detected',
  calibration_failed: 'Calibration needs improvement',
  insufficient_data: 'Insufficient gaze data',
  model_unavailable: 'Gaze model unavailable',
  backend_unavailable: 'Analysis server unreachable',
  backend_timeout: 'Analysis timed out',
  invalid_payload: 'Session data rejected',
  invalid_response: 'Unexpected server response',
  server_error: 'Analysis server error',
};

const CALIBRATION_ADVICE = {
  LOW_ACCURACY: 'Tracking was not accurate enough. Sit about an arm\'s length away, keep your head still, and follow each dot with your eyes only.',
  INSUFFICIENT_TRACKED_TARGETS: 'Your face was lost for too many of the dots. Keep your whole face in view and well lit.',
  NO_FIT: 'There was not enough clean tracking data to build a calibration.',
};

/* Small pieces ─────────────────────────────────────────────── */
function Check({ ok, label, hint }) {
  const state = ok === null ? 'pending' : ok ? 'ok' : 'bad';
  const color = state === 'ok' ? '#22D3EE' : state === 'bad' ? '#F8B4B4' : '#8FA3C0';
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem' }}>
      <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${color}`, color, display: 'grid', placeItems: 'center', fontSize: '0.7rem', flexShrink: 0 }}>
        {state === 'ok' ? '✓' : state === 'bad' ? '!' : '·'}
      </span>
      <span style={{ color: state === 'bad' ? '#F8B4B4' : 'inherit', fontWeight: 600 }}>{label}</span>
      {hint && state !== 'ok' && <span style={{ color: '#9FB0C8', fontWeight: 400 }}>— {hint}</span>}
      <span className="sr-only">{state === 'ok' ? 'good' : state === 'bad' ? 'needs attention' : 'checking'}</span>
    </li>
  );
}

function DebugPanel({ info }) {
  return (
    <pre aria-label="Gaze debug" style={{
      position: 'fixed', left: 12, bottom: 12, zIndex: 2000, margin: 0, padding: '10px 12px', borderRadius: 10,
      background: 'rgba(5,9,18,0.88)', color: '#7DF9C6', fontFamily: 'var(--font-data)', fontSize: 11, lineHeight: 1.5, pointerEvents: 'none',
    }}>
      {Object.entries(info).map(([k, v]) => `${k.padEnd(16)} ${v}`).join('\n')}
    </pre>
  );
}

/* ──────────────────────────────────────────────────────────────
   GazeSession Component
   onComplete(gazeSession, analysis) — analysis is the backend /gaze/analyze result
   onSkip(reason) — only from an explicit user choice; `reason` is a lowercase machine code
   ────────────────────────────────────────────────────────────── */
export default function GazeSession({ onComplete, onSkip, category }) {
  const [phase, setPhase] = useState('intro'); // intro|setup|calibration|calibrated|task|analyzing|result|error
  const [modelStatus, setModelStatus] = useState({ checking: true });
  const [camera, setCamera] = useState('idle'); // idle|initializing|ready
  const [face, setFace] = useState({ ok: null, reason: null, fps: 0, luma: null, stable: 0, holdLost: false });
  const [fault, setFault] = useState(null);     // { code, message, retry: 'setup'|'calibration'|'analysis'|'intro' }
  const [attempts, setAttempts] = useState(0);
  const [targetIdx, setTargetIdx] = useState(0);
  const [targetStage, setTargetStage] = useState('waiting'); // waiting|settle|collect
  const [calibration, setCalibration] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [stimulus, setStimulus] = useState(0);
  const [taskStats, setTaskStats] = useState({ valid: 0, invalid: 0, lost: 0 });
  const [analysis, setAnalysis] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [debug, setDebug] = useState({});

  const videoRef = useRef(null);       // hidden, ALWAYS-mounted element the tracker reads frames from
  const previewRef = useRef(null);     // visible mirrored preview (mounted/unmounted with the phase)
  const overlayRef = useRef(null);
  const trackerRef = useRef(null);
  const stableRef = useRef(0);
  const collectorRef = useRef(null);
  const modelRef = useRef(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const phaseRef = useRef('intro');
  const taskRef = useRef(null);
  const sessionRef = useRef(null);
  const calibMetaRef = useRef(null);
  const lastUiRef = useRef(0);
  const lastFaceRef = useRef({ ok: null, reason: null });
  const smootherRef = useRef(new GazeSmoother());
  const viewportRef = useRef({ w: 1, h: 1 });
  const reduceMotion = typeof document !== 'undefined' && document.body.classList.contains('reduce-motion');

  const go = useCallback((p) => { phaseRef.current = p; setPhase(p); }, []);

  /* ── model status (fail early: no point calibrating for a model that cannot run) ── */
  const loadModelStatus = () => gazeApi.status().then(
    (st) => ({ checking: false, available: Boolean(st.available), reason: st.reason, version: st.model_version }),
    (e) => ({ checking: false, available: null, error: e.message }),
  );
  const checkModel = () => { setModelStatus({ checking: true }); loadModelStatus().then((r) => mountedRef.current && setModelStatus(r)); };
  useEffect(() => {
    let alive = true;
    gazeApi.status().then(
      (st) => alive && setModelStatus({ checking: false, available: Boolean(st.available), reason: st.reason, version: st.model_version }),
      (e) => alive && setModelStatus({ checking: false, available: null, error: e.message }),
    );
    return () => { alive = false; };
  }, []);

  /* ── cleanup ── */
  const stopTracker = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setCamera('idle');
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; runIdRef.current += 1; stopTracker(); };
  }, [stopTracker]);

  // Keep the visible preview attached to the shared stream after every commit (it remounts per phase).
  useEffect(() => {
    const v = previewRef.current;
    const st = trackerRef.current?.stream;
    if (!v || !st) return;
    if (v.srcObject !== st) v.srcObject = st;
    if (v.paused) { const p = v.play?.(); p?.catch?.(() => { /* muted autoplay normally allowed */ }); }
  });

  const fail = useCallback((code, message, retry) => {
    runIdRef.current += 1;               // cancels any running calibration/task loop
    collectorRef.current = null;
    taskRef.current = null;
    setFault({ code, message, retry });
    go('error');
  }, [go]);

  /* ── landmark overlay (eye + iris points; every landmark in debug mode) ── */
  const drawOverlay = useCallback((lm) => {
    const c = overlayRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    if (c.width !== c.clientWidth) { c.width = c.clientWidth; c.height = c.clientHeight; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (!lm) return;
    // The <video> uses object-fit: cover, so map normalised coordinates through the cover transform.
    const vw = v.videoWidth, vh = v.videoHeight;
    const s = Math.max(c.width / vw, c.height / vh);
    const ox = (c.width - vw * s) / 2, oy = (c.height - vh * s) / 2;
    const idx = DEBUG_ENABLED ? lm.map((_, i) => i) : OVERLAY_INDICES;
    ctx.fillStyle = 'rgba(34,211,238,0.9)';
    for (const i of idx) {
      if (!lm[i]) continue;
      ctx.beginPath();
      ctx.arc(lm[i].x * vw * s + ox, lm[i].y * vh * s + oy, DEBUG_ENABLED ? 1.2 : (i === 468 || i === 473 ? 3 : 2), 0, 6.283);
      ctx.fill();
    }
  }, []);

  /* ── per-frame handler (runs at <= 30 Hz; React state is throttled) ── */
  const handleFrame = useCallback((fr) => {
    const p = phaseRef.current;
    const okFace = fr.ok;
    if (okFace) stableRef.current += 1;
    else if (fr.reason !== FACE_REASONS.BLINK) stableRef.current = 0;   // blinks are neutral
    lastFaceRef.current = { ok: okFace, reason: fr.reason };
    if (p === 'setup' || p === 'calibration') drawOverlay(fr.landmarks);

    // calibration collection
    if (collectorRef.current && okFace) collectorRef.current.push(fr.features);

    // visual task sampling
    const task = taskRef.current;
    if (p === 'task' && task) {
      const { w, h } = viewportRef.current;
      if (okFace) {
        const pred = predict(modelRef.current, fr.features);
        const inRange = pred[0] > -OUT_OF_RANGE && pred[0] < 1 + OUT_OF_RANGE && pred[1] > -OUT_OF_RANGE && pred[1] < 1 + OUT_OF_RANGE;
        const sm = inRange ? smootherRef.current.push([Math.min(Math.max(pred[0], 0), 1), Math.min(Math.max(pred[1], 0), 1)], w / h) : null;
        if (sm && fr.t > task.lastT) {
          task.samples.push({
            timestamp: Math.round(fr.t * 100) / 100, x: sm[0] * w, y: sm[1] * h,
            stimulus_id: STIMULI[task.stim()].key, face_detected: true,
          });
          task.lastT = fr.t;
          task.valid += 1;
        } else {
          task.invalid += 1;
        }
      } else if (fr.reason !== FACE_REASONS.BLINK && fr.t > task.lastT && fr.t - task.lastT > 100) {
        task.samples.push({ timestamp: Math.round(fr.t * 100) / 100, x: null, y: null, stimulus_id: STIMULI[task.stim()].key, face_detected: false });
        task.lastT = fr.t;
        task.lost += 1;
      }
    }

    // throttled UI state (5 Hz)
    if (fr.t - lastUiRef.current > 200) {
      lastUiRef.current = fr.t;
      const lowLight = fr.luma !== null && fr.luma !== undefined && fr.luma < LOW_LIGHT;
      setFace({ ok: okFace, reason: lowLight && okFace ? 'LOW_LIGHT' : fr.reason, fps: fr.fps, luma: fr.luma, stable: stableRef.current, holdLost: !okFace && fr.reason !== FACE_REASONS.BLINK });
      if (DEBUG_ENABLED) {
        setDebug({
          fps: fr.fps, face: okFace ? 'yes' : `no (${fr.reason})`, landmarks: fr.landmarks ? fr.landmarks.length : 0,
          features: okFace ? fr.features.map((v) => v.toFixed(2)).join(' ') : '-', featureOrder: FEATURE_NAMES.join(','),
          validSamples: task ? task.valid : 0, calibration: calibMetaRef.current ? `${Math.round(calibMetaRef.current.quality * 100)}%` : '-',
          model: modelStatus.available ? `ready ${modelStatus.version || ''}` : String(modelStatus.reason || modelStatus.available),
          luma: fr.luma ? Math.round(fr.luma) : '-',
        });
      }
      if (task) setTaskStats({ valid: task.valid, invalid: task.invalid, lost: task.lost });
    }
  }, [drawOverlay, modelStatus]);

  /* ── camera + face setup ── */
  const startSetup = useCallback(async () => {
    setFault(null);
    stableRef.current = 0;
    setCamera('initializing');
    go('setup');
    stopTracker();
    const tracker = new FaceTracker((fr) => handleFrame(fr));
    trackerRef.current = tracker;
    try {
      // wait for the <video> element of the setup card to exist
      for (let i = 0; i < 40 && !videoRef.current; i++) await sleep(25);
      await tracker.start(videoRef.current);
      if (!mountedRef.current) { tracker.stop(); return; }
      setCamera('ready');
    } catch (e) {
      trackerRef.current = null;
      if (!mountedRef.current) return;
      const code = (e instanceof TrackerError ? e.code : 'CAMERA_ERROR').toLowerCase();
      fail(code, e.message, 'setup');
    }
  }, [fail, go, handleFrame, stopTracker]);

  /* ── calibration ── */
  const runCalibration = useCallback(async () => {
    const token = ++runIdRef.current;
    const cancelled = () => runIdRef.current !== token || !mountedRef.current;
    viewportRef.current = { w: window.innerWidth, h: window.innerHeight };
    const started = nowMs();
    go('calibration');
    setFault(null);
    const collected = [];
    for (let i = 0; i < TARGETS.length; i++) {
      setTargetIdx(i);
      setTargetStage('waiting');
      const frames = [];
      let t0 = null;
      const giveUp = nowMs() + 25_000;
      while (!cancelled()) {
        if (stableRef.current < STABLE_FRAMES) {            // face lost / unstable: HOLD (never fail the session)
          t0 = null; frames.length = 0; collectorRef.current = null; setTargetStage('waiting');
        } else {
          if (t0 === null) t0 = nowMs();
          const e = nowMs() - t0;
          if (e < SETTLE_MS) setTargetStage('settle');
          else {
            collectorRef.current = frames;
            setTargetStage('collect');
            const done = (e >= SETTLE_MS + COLLECT_MS && frames.length >= TARGET_FRAMES) || e >= SETTLE_MS + COLLECT_MAX_MS;
            if (done) break;
          }
        }
        if (nowMs() > giveUp) break;
        await sleep(40);
      }
      collectorRef.current = null;
      if (cancelled()) return;
      collected.push({ t: TARGETS[i], frames });
    }
    const { w, h } = viewportRef.current;
    const result = assessCalibration(collected, w, h);
    calibMetaRef.current = { ...result, duration_ms: Math.round(nowMs() - started), w, h };
    setCalibration(result);
    setModelReady(false);
    if (result.accepted) {
      const samples = result.cleaned.flatMap((tg) => tg.frames.map((f) => ({ f, t: tg.t })));
      modelRef.current = fit(samples);
      setModelReady(Boolean(modelRef.current));
      if (!modelRef.current) result.reasons.push('NO_FIT');
    }
    setAttempts((a) => a + 1);
    go('calibrated');
  }, [go]);

  /* ── backend analysis (quality gate + model) ── */
  const runAnalysis = useCallback(async () => {
    setFault(null);
    go('analyzing');
    try {
      const result = await gazeApi.analyze(sessionRef.current);
      setAnalysis(result);
      go('result');
    } catch (err) {
      fail(GAZE_FAULT_BY_API_KIND[err.kind] || 'server_error', err.message, 'analysis');
    }
  }, [fail, go]);

  const finishTask = useCallback((task, durationMs) => {
    taskRef.current = null;
    stopTracker();
    const validCount = task.samples.filter((s) => s.face_detected).length;
    if (validCount < MIN_TASK_SAMPLES) {
      fail('insufficient_data', `Only ${validCount} usable gaze samples were captured in ${(durationMs / 1000).toFixed(0)} seconds. Please repeat the test with your face in view.`, 'setup');
      return;
    }
    const meta = calibMetaRef.current;
    sessionRef.current = {
      session_id: crypto.randomUUID(),
      category,
      screen_width: viewportRef.current.w,
      screen_height: viewportRef.current.h,
      calibration: {
        completed: true, quality_score: meta.quality, sample_count: meta.validFrames,
        duration_ms: meta.duration_ms, mean_error_px: meta.meanErrPx ?? undefined, method: 'mediapipe_iris_ridge_9pt_auto',
      },
      samples: task.samples,
    };
    runAnalysis();
  }, [category, fail, runAnalysis, stopTracker]);

  /* ── 30-second task ── */
  const startTask = useCallback(() => {
    const token = ++runIdRef.current;
    const cancelled = () => runIdRef.current !== token || !mountedRef.current;
    viewportRef.current = { w: window.innerWidth, h: window.innerHeight };
    smootherRef.current.reset();
    const t0 = nowMs();
    const task = { samples: [], valid: 0, invalid: 0, lost: 0, lastT: -1, stim: () => Math.min(Math.floor((nowMs() - t0) / STIMULUS_MS), STIMULI.length - 1) };
    taskRef.current = task;
    setElapsed(0); setStimulus(0); setTaskStats({ valid: 0, invalid: 0, lost: 0 });
    go('task');
    const timer = setInterval(() => {
      if (cancelled()) { clearInterval(timer); return; }
      const e = nowMs() - t0;                              // real elapsed time, not a counter
      setElapsed(Math.min(e, TASK_MS));
      setStimulus(task.stim());
      if (e >= TASK_MS) { clearInterval(timer); finishTask(task, e); }
    }, 200);
  }, [go, finishTask]);

  const handleSkip = (reason) => {
    runIdRef.current += 1;
    stopTracker();
    // A click handler passes an event object; only a string counts as a reason.
    onSkip(typeof reason === 'string' && reason ? reason : 'user_skipped');
  };
  const handleContinue = () => onComplete(sessionRef.current, analysis);

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  const stepIndex = { intro: 0, setup: face.ok ? 1 : 0, calibration: 2, calibrated: 2, task: 3, analyzing: 4, result: 5, error: 0 }[phase] ?? 0;
  const rail = <div style={{ marginBottom: 20 }}><ProgressIndicator steps={STEPS} current={stepIndex} /></div>;

  const trackLabel = (() => {
    if (phase === 'task') return 'TRACKING';
    if (phase === 'calibration') return 'CALIBRATING';
    if (phase === 'calibrated') return calibration?.accepted ? 'CALIBRATION COMPLETE' : 'CALIBRATION FAILED';
    if (camera === 'initializing') return 'INITIALIZING';
    if (camera === 'ready') return face.ok ? 'FACE DETECTED' : 'FACE NOT DETECTED';
    return 'NOT STARTED';
  })();

  const guidance = (() => {
    if (face.ok && face.reason === 'LOW_LIGHT') return GUIDANCE.LOW_LIGHT;
    if (face.ok) return 'Face detected. Keep your head still and look at the screen.';
    return GUIDANCE[face.reason] || 'Looking for your face…';
  })();

  const debugPanel = DEBUG_ENABLED ? <DebugPanel info={{ state: trackLabel, phase, attempts, ...debug }} /> : null;
  const preview = (
    <div className="ns-gaze-preview" style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 14, overflow: 'hidden', background: '#050912' }}>
      <video ref={previewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
    </div>
  );

  const renderPhase = () => {
  if (phase === 'intro') {
    const blocked = modelStatus.available === false;
    return (
      <section style={{ ...card, position: 'relative' }}>
        {rail}
        <div style={{ marginBottom: 18 }}><GazeVisualizer size={150} /></div>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Gaze session {category === 'child' ? '(child)' : ''}</h2>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7, maxWidth: 640, marginBottom: 6 }}>
          We use the webcam to estimate where on the screen the child looks during a short picture task. The steps are: camera check,
          face detection, a 9-dot calibration (just look at each dot), a <strong>30-second</strong> picture task, then analysis.
          Video is <strong>not recorded or stored</strong>; only gaze coordinates are sent.
        </p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 18 }}>
          Sit about an arm&apos;s length from the screen in a well-lit room. Works in Chrome and Edge on localhost or HTTPS.
        </p>
        <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', fontWeight: 600, marginBottom: 18,
          color: modelStatus.checking ? 'var(--ns-n500)' : blocked ? 'var(--ns-risk-high-text)' : modelStatus.available ? 'var(--ns-risk-low-text)' : 'var(--ns-risk-mod-text)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
          {modelStatus.checking ? 'Checking the gaze model…'
            : blocked ? `Gaze model unavailable — ${reasonText(modelStatus.reason)}`
            : modelStatus.available ? `Gaze model ready${modelStatus.version ? ` (${modelStatus.version})` : ''}`
            : 'Could not verify the gaze model; the analysis step will report its status.'}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={startSetup} disabled={modelStatus.checking || blocked} style={{ ...primaryBtn, opacity: modelStatus.checking || blocked ? 0.5 : 1 }}>Start camera check</button>
          {blocked && <button type="button" onClick={checkModel} style={ghostBtn}>Check again</button>}
          <button type="button" onClick={() => handleSkip(blocked ? 'model_unavailable' : 'user_skipped')} style={skipText}>
            {blocked ? 'Continue without gaze (model unavailable)' : 'Skip gaze step'}
          </button>
        </div>
        {debugPanel}
      </section>
    );
  }

  if (phase === 'setup') {
    const checks = [
      ['Camera', camera === 'ready' ? true : camera === 'initializing' ? null : false, 'starting…'],
      ['Face', camera === 'ready' ? Boolean(face.ok) || face.reason === FACE_REASONS.BLINK : null, GUIDANCE[face.reason] || 'not detected yet'],
      ['Position', camera !== 'ready' || face.ok === null ? null : face.reason !== FACE_REASONS.OFF_CENTER, GUIDANCE[FACE_REASONS.OFF_CENTER]],
      ['Distance', camera !== 'ready' || face.ok === null ? null : face.reason !== FACE_REASONS.TOO_FAR && face.reason !== FACE_REASONS.TOO_CLOSE, face.reason === FACE_REASONS.TOO_CLOSE ? GUIDANCE[FACE_REASONS.TOO_CLOSE] : GUIDANCE[FACE_REASONS.TOO_FAR]],
      ['Lighting', face.luma === null || face.luma === undefined ? null : face.luma >= LOW_LIGHT, GUIDANCE.LOW_LIGHT],
      ['Tracking', camera === 'ready' ? face.fps >= 8 : null, 'frame rate is low'],
    ];
    const ready = camera === 'ready' && face.ok && face.stable >= STABLE_FRAMES && !(face.luma !== null && face.luma < LOW_LIGHT);
    return (
      <section className="ns-dark" style={{ ...card, position: 'relative', background: 'var(--ns-navy-900)', color: '#E6ECF5', border: '1px solid rgba(148,163,184,0.16)' }}>
        <button type="button" onClick={() => handleSkip('user_skipped')} style={{ ...skipLink, color: '#8FA3C0' }}>Skip this step →</button>
        {rail}
        <p className="ns-eyebrow ns-eyebrow--dark" role="status">{trackLabel}</p>
        <h2 style={{ marginTop: 8, marginBottom: 6 }}>Check your camera and face</h2>
        <p style={{ margin: '0 0 18px', color: '#9FB0C8', maxWidth: 'none' }}>{guidance}</p>
        <div className="ns-gaze-setup">
          <div style={{ maxWidth: 420, width: '100%' }}>{preview}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, alignContent: 'start' }} aria-label="Camera and face checks">
            {checks.map(([label, ok, hint]) => <Check key={label} ok={ok} label={label} hint={hint} />)}
          </ul>
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={runCalibration} disabled={!ready} style={{ ...primaryBtn, opacity: ready ? 1 : 0.5 }}>Begin calibration</button>
          {!ready && <span style={{ fontSize: '0.82rem', color: '#8FA3C0' }}>Enabled once your face is detected and steady.</span>}
        </div>
        <style>{'.ns-gaze-setup{display:grid;grid-template-columns:minmax(0,420px) 1fr;gap:26px}@media (max-width:760px){.ns-gaze-setup{grid-template-columns:1fr}}'}</style>
        {debugPanel}
      </section>
    );
  }

  if (phase === 'calibration') {
    const [fx, fy] = TARGETS[targetIdx];
    const lost = face.holdLost;
    return createPortal(
      <div role="dialog" aria-label="Calibration" style={{ position: 'fixed', inset: 0, background: 'var(--ns-navy-900)', zIndex: 1000 }}>
        <button type="button" onClick={() => handleSkip('user_skipped')} style={{ ...skipLink, position: 'absolute', color: 'var(--color-neutral-400)' }}>Skip this step →</button>
        <div style={{ position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', padding: '0 16px' }}>
          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.72rem', letterSpacing: '0.14em', color: '#8FA3C0', margin: '0 0 6px' }}>
            CALIBRATING · POINT {targetIdx + 1} OF {TARGETS.length}
          </p>
          <p role="status" style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: lost ? '#F8B4B4' : '#F4F7FB' }}>
            {lost ? 'FACE LOST — hold still and face the screen' : targetStage === 'waiting' ? 'Get ready…' : 'Look directly at the glowing point'}
          </p>
        </div>
        <span aria-hidden="true" style={{
          position: 'absolute', left: `${fx * 100}%`, top: `${fy * 100}%`, width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: '50%',
          background: lost ? '#64748B' : '#22D3EE', boxShadow: lost ? 'none' : '0 0 0 6px rgba(34,211,238,0.18), 0 0 22px rgba(34,211,238,0.6)',
          transition: reduceMotion ? 'none' : 'left 320ms ease, top 320ms ease',
          animation: reduceMotion || targetStage !== 'collect' ? 'none' : 'ns-pulse 1s ease-in-out infinite',
        }} />
        <div style={{ position: 'absolute', left: '50%', top: '71%', transform: 'translate(-50%, -50%)', width: 150, pointerEvents: 'none' }}>{preview}</div>
        {debugPanel}
      </div>,
      document.body,
    );
  }

  if (phase === 'calibrated' && calibration) {
    const q = Math.round(calibration.quality * 100);
    const ok = calibration.accepted && modelReady;
    const exhausted = attempts >= MAX_ATTEMPTS;
    return (
      <section style={card}>
        {rail}
        <p className="ns-eyebrow" role="status">{ok ? 'CALIBRATION COMPLETE' : 'CALIBRATION NEEDS IMPROVEMENT'}</p>
        <h2 style={{ margin: '8px 0 6px' }}>Calibration quality: {q}% <span style={{ fontSize: '0.9rem', fontWeight: 600, color: ok ? 'var(--ns-risk-low-text)' : 'var(--ns-risk-mod-text)' }}>{ok ? 'READY' : 'RETRY'}</span></h2>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.65, margin: '0 0 6px' }}>
          {calibration.targetsOk} of {calibration.targetsTotal} points tracked · {calibration.validFrames} clean frames ({calibration.rawFrames} captured)
          {calibration.meanErrPx !== null && ` · typical error ≈ ${calibration.meanErrPx}px (${(calibration.meanErrFrac * 100).toFixed(1)}% of the screen diagonal, limit ${(MAX_MEAN_ERR_FRAC * 100).toFixed(0)}%)`}.
          This is a technical tracking-quality indicator, not a clinical measure.
        </p>
        {!ok && (
          <p role="alert" style={{ color: 'var(--ns-risk-mod-text)', lineHeight: 1.65, margin: '8px 0 0' }}>
            {calibration.reasons.map((r) => CALIBRATION_ADVICE[r]).filter(Boolean).join(' ')} (Attempt {attempts} of {MAX_ATTEMPTS}.)
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20, alignItems: 'center' }}>
          {ok ? <button type="button" onClick={startTask} style={primaryBtn}>Start the 30-second task</button>
            : <button type="button" onClick={startSetup} style={primaryBtn}>Recalibrate</button>}
          {ok && <button type="button" onClick={startSetup} style={ghostBtn}>Recalibrate anyway</button>}
          {(!ok && exhausted) && <button type="button" onClick={() => handleSkip('calibration_failed')} style={skipText}>Skip the gaze step (the report will say why)</button>}
        </div>
        {debugPanel}
      </section>
    );
  }

  if (phase === 'error' && fault) {
    const retryLabel = { setup: 'Try again', calibration: 'Recalibrate', analysis: 'Retry analysis', intro: 'Check again' }[fault.retry];
    const onRetry = fault.retry === 'analysis' ? runAnalysis : startSetup;
    return (
      <section style={{ ...card, position: 'relative', border: '1px solid var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
        <p className="ns-eyebrow" style={{ color: 'var(--color-risk-high)' }}>{fault.code.toUpperCase()}</p>
        <h3 style={{ marginTop: 6, color: 'var(--color-risk-high)', marginBottom: 10 }}>{FAULT_TITLES[fault.code] || 'Gaze step problem'}</h3>
        <p role="alert" style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7, marginBottom: 20 }}>{fault.message}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onRetry} style={primaryBtn}>{retryLabel}</button>
          <button type="button" onClick={() => handleSkip(fault.code)} style={skipText}>Skip the gaze step (the report will say why)</button>
        </div>
        {debugPanel}
      </section>
    );
  }

  if (phase === 'task') {
    const stim = STIMULI[stimulus] || STIMULI[0];
    const secs = Math.floor(elapsed / 1000);
    const total = taskStats.valid + taskStats.invalid + taskStats.lost;
    const quality = total ? Math.round((taskStats.valid / total) * 100) : null;
    const mm = (s) => `00:${String(s).padStart(2, '0')}`;
    return (
      <section className="ns-dark" style={{ position: 'relative', background: 'var(--ns-navy-900)', borderRadius: 20, minHeight: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, userSelect: 'none' }}>
        <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-data)', fontSize: '0.74rem', letterSpacing: '0.08em', color: '#9FB0C8' }}>
          <span role="timer" aria-label={`${secs} of 30 seconds`} style={{ color: '#F4F7FB', fontSize: '1.05rem', fontWeight: 600 }}>GAZE ANALYSIS · {mm(secs)} / 00:30</span>
          <span role="status">
            <span style={{ color: face.holdLost ? '#F8B4B4' : '#22D3EE' }}>● {face.holdLost ? 'FACE LOST' : 'TRACKING'}</span>
            {' · '}Face {face.holdLost ? '✕' : '✓'}{' · '}Quality {quality === null ? '—' : `${quality}%`}
          </span>
        </div>
        <p style={{ color: 'var(--color-neutral-400)', fontSize: '0.85rem', marginBottom: 24, fontWeight: 600 }}>Picture {stimulus + 1} / {STIMULI.length}</p>
        <div style={{ marginBottom: 20 }}><StimulusSVG stimulus={stim} /></div>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.82rem', marginTop: 16 }}>
          {face.holdLost ? 'Please face the screen so tracking can continue.' : 'Just look at the pictures naturally.'}
        </p>
        <div style={{ position: 'absolute', right: 16, bottom: 16, width: 132, opacity: 0.9 }}>{preview}</div>
        {debugPanel}
      </section>
    );
  }

  if (phase === 'analyzing') {
    return (
      <section style={{ ...card, textAlign: 'center', padding: '56px 28px' }} role="status">
        <GazeVisualizer size={120} />
        <p style={{ color: 'var(--color-neutral-700)', fontWeight: 600, fontSize: '1.05rem', marginTop: 12 }}>Analyzing gaze behaviour…</p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.85rem', marginTop: 8 }}>Checking data quality and running the gaze model on the server.</p>
        {debugPanel}
      </section>
    );
  }

  if (phase === 'result' && analysis) {
    const q = analysis.quality;
    if (analysis.status !== 'success') {
      const poor = analysis.status === 'insufficient_quality';
      return (
        <section style={{ ...card, border: '1px solid var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
          {rail}
          <p className="ns-eyebrow" style={{ color: 'var(--color-risk-high)' }}>{(analysis.error_code || (poor ? 'INSUFFICIENT_DATA' : 'MODEL_UNAVAILABLE'))}</p>
          <h3 style={{ marginTop: 6, color: 'var(--color-risk-high)' }}>{poor ? 'Gaze data quality too low' : 'Gaze analysis not available'}</h3>
          <p role="alert" style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
            {reasonText(analysis.reason)} ({q.valid_sample_count} of {q.sample_count} samples usable, {q.duration_s}s.)
            {' '}Gaze will be reported as <strong>not available</strong>; it will not count as a low or high result.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
            {poor ? <button type="button" onClick={startSetup} style={primaryBtn}>Repeat gaze test</button> : <button type="button" onClick={runAnalysis} style={primaryBtn}>Retry analysis</button>}
            <button type="button" onClick={handleContinue} style={skipText}>Continue (the report will show why gaze was not scored)</button>
          </div>
        </section>
      );
    }
    return (
      <section style={card}>
        {rail}
        <p className="ns-eyebrow">ANALYZED</p>
        <h3 style={{ marginTop: 6, color: 'var(--color-neutral-900)' }}>Gaze session recorded</h3>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          {q.valid_sample_count} of {q.sample_count} samples were usable over {q.duration_s}s (calibration quality {Math.round((q.calibration_score ?? 0) * 100)}%).
          The gaze model output will appear with your final results.
        </p>
        <button type="button" onClick={handleContinue} style={primaryBtn}>Continue</button>
      </section>
    );
  }

  return null;
  };

  return (
    <>
      {/* Frame source for the tracker: rendered in every phase so the stream never loses its element. */}
      <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" tabIndex={-1}
        style={{ position: 'fixed', width: 2, height: 2, opacity: 0, pointerEvents: 'none', left: 0, top: 0 }} />
      {renderPhase()}
    </>
  );
}
