import { useCallback, useEffect, useRef, useState } from 'react';
import { gazeApi } from '../services/api';

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
   GazeSession Component
   ────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────
   Gaze capture parameters (mirrored by backend/ml/gaze/config.py)
   ────────────────────────────────────────────────────────────── */
const CLICKS_PER_POINT = 3;
const TASK_SECONDS = 30;
const STIMULUS_MS = 6000;
const MIN_SAMPLE_INTERVAL_MS = 20;     // cap at 50 Hz
const VALIDATION_TARGETS = [           // viewport fractions
  [0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85],
];
const VALIDATION_DWELL_MS = 2000;      // first half settles, second half is measured
const VALIDATION_MIN_PREDICTIONS = 5;
const MAX_CALIBRATION_ERROR_DIAG = 0.2; // quality_score hits 0 at this error / screen diagonal
const MIN_CALIBRATION_SCORE = 0.4;      // mirrors backend MIN_CALIBRATION_SCORE

const median = (a) => {
  const s = [...a].sort((p, q) => p - q);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
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
  requires_unavailable_feature: 'The installed gaze model needs data a browser cannot provide.',
  preprocess_config_mismatch: 'The installed gaze model does not match the current pipeline.',
  inference_failed: 'The gaze model failed while analysing this session.',
};
const reasonText = (r) => REASON_TEXT[r] || (r ? `Reason: ${r}` : 'Unknown reason.');

const FAULT_TITLES = {
  camera_denied: 'Camera access denied',
  camera_unavailable: 'Camera unavailable',
  engine_load_failed: 'Eye-tracking library unavailable',
  engine_init_failed: 'Eye-tracking failed to start',
  calibration_failed: 'Calibration failed',
  calibration_poor: 'Calibration not accurate enough',
  backend_unavailable: 'Analysis server unreachable',
  backend_timeout: 'Analysis timed out',
  invalid_payload: 'Session data rejected',
  invalid_response: 'Unexpected server response',
  server_error: 'Analysis server error',
};

/* ──────────────────────────────────────────────────────────────
   GazeSession Component
   onComplete(gazeSession, analysis) — analysis is the backend /gaze/analyze result
   ────────────────────────────────────────────────────────────── */
export default function GazeSession({ onComplete, onSkip, category }) {
  const [phase, setPhase] = useState('intro');
  const [stream, setStream] = useState(null);
  const [countdown, setCountdown] = useState(TASK_SECONDS);
  const [fault, setFault] = useState(null); // { kind, message, retry: 'camera' | 'calibration' | 'analysis' }
  const [calibrationClicks, setCalibrationClicks] = useState({});
  const [currentStimulus, setCurrentStimulus] = useState(0);
  const [validationIdx, setValidationIdx] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [sampleCount, setSampleCount] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const samplesRef = useRef([]);
  const stimRef = useRef(0);
  const lastSampleT = useRef(0);
  const listenerMode = useRef('idle'); // 'idle' | 'validation' | 'task'
  const validationBuf = useRef([]);
  const calibrationRef = useRef(null);
  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  const stimulusTimerRef = useRef(null);
  const validationTimerRef = useRef(null);
  const reduceMotion = typeof document !== 'undefined' && document.body.classList.contains('reduce-motion');

  /* ── Load WebGazer script ───────────────────────────────── */
  const loadWebGazer = () =>
    new Promise((resolve, reject) => {
      if (window.webgazer) { resolve(window.webgazer); return; }
      const script = document.createElement('script');
      script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      script.async = true;
      script.onload = () => resolve(window.webgazer);
      script.onerror = () => reject(new Error('Failed to load WebGazer script'));
      document.body.appendChild(script);
    });

  const clearTimers = useCallback(() => {
    clearInterval(timerRef.current);
    clearTimeout(stimulusTimerRef.current);
    clearTimeout(validationTimerRef.current);
  }, []);

  /* ── Stop camera & WebGazer ─────────────────────────────── */
  const stopStream = useCallback(() => {
    listenerMode.current = 'idle';
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (window.webgazer) {
      try {
        window.webgazer.pause();
        window.webgazer.clearData();
        window.webgazer.showVideoPreview(false).showPredictionPoints(false);
      } catch {
        // webgazer may already be torn down
      }
    }
  }, []);

  useEffect(() => () => { stopStream(); clearTimers(); }, [stopStream, clearTimers]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, phase]);

  const fail = (kind, message, retry) => {
    clearTimers();
    listenerMode.current = 'idle';
    setFault({ kind, message, retry });
    setPhase('error');
  };

  /* ── Single WebGazer listener; behaviour depends on listenerMode ── */
  function handleGaze(data) {
    const now = performance.now();
    if (listenerMode.current === 'validation') {
      if (data) validationBuf.current.push({ x: data.x, y: data.y });
    } else if (listenerMode.current === 'task') {
      if (now - lastSampleT.current < MIN_SAMPLE_INTERVAL_MS) return;
      lastSampleT.current = now;
      samplesRef.current.push({
        timestamp: Math.round(now * 100) / 100,
        x: data ? data.x : null,
        y: data ? data.y : null,
        stimulus_id: STIMULI[stimRef.current].key,
        face_detected: Boolean(data),
      });
    }
  }

  /* ── Camera → WebGazer ──────────────────────────────────── */
  const requestCamera = async () => {
    setFault(null);
    setPhase('permission');
    let mediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (camErr) {
      if (camErr.name === 'NotAllowedError') {
        fail('camera_denied', 'Camera permission was denied. Allow camera access in your browser settings, then try again.', 'camera');
      } else {
        fail('camera_unavailable', 'No usable camera was found (it may be in use by another app).', 'camera');
      }
      return;
    }
    streamRef.current = mediaStream;
    setStream(mediaStream);

    let wg;
    try {
      wg = await loadWebGazer();
    } catch {
      fail('engine_load_failed', 'The eye-tracking library could not be loaded. Check your network connection.', 'camera');
      return;
    }
    try {
      wg.params.faceMeshSolutionPath = '/mediapipe/face_mesh';
      wg.setGazeListener(handleGaze);
      await wg
        .setRegression('ridge')
        .setTracker('TFFacemesh')
        .showVideoPreview(false)
        .showPredictionPoints(false)
        .begin();
      startCalibration();
    } catch (wgErr) {
      console.error('WebGazer Init Error:', wgErr);
      fail('engine_init_failed', 'The eye-tracking engine failed to start.', 'camera');
    }
  };

  /* ── Calibration (9 points × CLICKS_PER_POINT clicks) ────── */
  const startCalibration = () => {
    setFault(null);
    setCalibrationClicks({});
    calibrationRef.current = null;
    try { window.webgazer.clearData(); } catch { /* fresh engine */ }
    setPhase('calibration');
  };

  const handleCalibrationClick = (index, e) => {
    if (window.webgazer && e) {
      window.webgazer.recordScreenPosition(e.clientX, e.clientY, 'click');
    }
    setCalibrationClicks((prev) => {
      const count = (prev[index] || 0) + 1;
      if (count > CLICKS_PER_POINT) return prev;
      const next = { ...prev, [index]: count };
      const done = Object.values(next).filter((c) => c >= CLICKS_PER_POINT).length;
      if (done === 9) setTimeout(startValidation, 300);
      return next;
    });
  };

  /* ── Calibration validation: 5 fixed targets, measure pixel error ── */
  const startValidation = () => {
    setPhase('validation');
    const errors = [];
    let idx = 0;
    const runTarget = () => {
      validationBuf.current = [];
      listenerMode.current = 'idle';
      setValidationIdx(idx);
      validationTimerRef.current = setTimeout(() => {   // settle
        listenerMode.current = 'validation';
        validationTimerRef.current = setTimeout(() => { // measure
          listenerMode.current = 'idle';
          const [fx, fy] = VALIDATION_TARGETS[idx];
          const buf = validationBuf.current;
          if (buf.length < VALIDATION_MIN_PREDICTIONS) {
            errors.push({ err: NaN, n: buf.length });
          } else {
            const mx = median(buf.map((p) => p.x));
            const my = median(buf.map((p) => p.y));
            errors.push({ err: Math.hypot(mx - fx * window.innerWidth, my - fy * window.innerHeight), n: buf.length });
          }
          idx += 1;
          if (idx < VALIDATION_TARGETS.length) runTarget();
          else finishValidation(errors);
        }, VALIDATION_DWELL_MS / 2);
      }, VALIDATION_DWELL_MS / 2);
    };
    runTarget();
  };

  const finishValidation = (errors) => {
    const good = errors.filter((e) => Number.isFinite(e.err));
    if (good.length < 3) {
      fail('calibration_failed', 'Your eyes could not be tracked reliably during calibration. Make sure your face is well lit and centred, then recalibrate.', 'calibration');
      return;
    }
    const meanErr = good.reduce((a, e) => a + e.err, 0) / good.length;
    const diag = Math.hypot(window.innerWidth, window.innerHeight);
    const score = Math.max(0, Math.min(1, 1 - meanErr / diag / MAX_CALIBRATION_ERROR_DIAG));
    calibrationRef.current = {
      completed: true,
      quality_score: Math.round(score * 1000) / 1000,
      sample_count: good.reduce((a, e) => a + e.n, 0),
      mean_error_px: Math.round(meanErr * 10) / 10,
      method: 'webgazer_ridge_9pt_click_5pt_validation',
    };
    if (score < MIN_CALIBRATION_SCORE) {
      fail('calibration_poor', `Calibration accuracy was too low (quality ${score.toFixed(2)}, needs ${MIN_CALIBRATION_SCORE}). Sit about an arm's length from the screen, keep your head still, and recalibrate.`, 'calibration');
      return;
    }
    startTask();
  };

  /* ── 30-second task ─────────────────────────────────────── */
  const startTask = () => {
    setPhase('task');
    setCountdown(TASK_SECONDS);
    setCurrentStimulus(0);
    stimRef.current = 0;
    samplesRef.current = [];
    lastSampleT.current = 0;
    listenerMode.current = 'task';

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          finishTask();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const rotate = () => {
      if (stimRef.current < STIMULI.length - 1) {
        stimRef.current += 1;
        setCurrentStimulus(stimRef.current);
        stimulusTimerRef.current = setTimeout(rotate, STIMULUS_MS);
      }
    };
    stimulusTimerRef.current = setTimeout(rotate, STIMULUS_MS);
  };

  const finishTask = () => {
    clearTimers();
    listenerMode.current = 'idle';
    const samples = [...samplesRef.current];
    setSampleCount(samples.length);
    stopStream();
    sessionRef.current = {
      session_id: crypto.randomUUID(),
      category,
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
      calibration: calibrationRef.current,
      samples,
    };
    runAnalysis();
  };

  /* ── Backend analysis (quality gate + model) ────────────── */
  const runAnalysis = async () => {
    setFault(null);
    setPhase('analyzing');
    try {
      const result = await gazeApi.analyze(sessionRef.current);
      setAnalysis(result);
      setPhase('result');
    } catch (err) {
      fail(err.kind || 'backend_unavailable', err.message, 'analysis');
    }
  };

  const handleSkip = () => {
    stopStream();
    clearTimers();
    onSkip();
  };

  const handleContinue = () => onComplete(sessionRef.current, analysis);

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */
  const preview = (opacity) => (
    <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '160px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: `2px solid rgba(255,255,255,${opacity})` }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
    </div>
  );
  const spinner = (size) => (
    <div style={{ display: 'inline-block', width: size, height: size, border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: reduceMotion ? 'none' : 'spin 0.8s linear infinite' }} />
  );

  if (phase === 'intro') {
    return (
      <section style={{ ...card, position: 'relative' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)', marginBottom: '12px' }}>
          Gaze Session {category === 'child' ? '(Child)' : '(Adult)'}
        </h2>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7, maxWidth: '640px', marginBottom: '6px' }}>
          We will use the webcam to estimate where on the screen the child looks during a short picture task.
          You will first click nine calibration dots, then look at five targets to check accuracy, then view the pictures for
          <strong> 30 seconds</strong>. Video is <strong>not recorded or stored</strong>; only gaze coordinates are sent.
        </p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Sit about an arm&apos;s length from the screen in a well-lit room and keep your head still. This step is optional.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={requestCamera} style={primaryBtn}>Continue</button>
          <button type="button" onClick={handleSkip} style={ghostBtn}>Skip gaze step</button>
        </div>
      </section>
    );
  }

  if (phase === 'permission') {
    return (
      <section style={{ ...card, position: 'relative', textAlign: 'center', padding: '48px 28px' }}>
        <button type="button" onClick={handleSkip} style={skipLink}>Skip this step →</button>
        {spinner(32)}
        <p style={{ color: 'var(--color-neutral-600)', marginTop: '16px', fontWeight: 600 }}>Starting camera and eye-tracking…</p>
      </section>
    );
  }

  if (phase === 'error' && fault) {
    const retryLabel = { camera: 'Try again', calibration: 'Recalibrate', analysis: 'Retry analysis' }[fault.retry];
    const onRetry = fault.retry === 'analysis' ? runAnalysis
      : fault.retry === 'calibration' ? startCalibration : requestCamera;
    return (
      <section style={{ ...card, position: 'relative', borderColor: 'var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--color-risk-high)', marginBottom: '10px' }}>{FAULT_TITLES[fault.kind] || 'Gaze step problem'}</h3>
        <p role="alert" style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7, marginBottom: '20px' }}>
          {fault.message} You can retry, or continue the screening without the gaze step (gaze will be reported as not available).
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onRetry} style={primaryBtn}>{retryLabel}</button>
          <button type="button" onClick={handleSkip} style={{ ...ghostBtn, borderColor: 'var(--color-risk-high-border)', color: 'var(--color-risk-high)' }}>
            Continue without gaze →
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'calibration') {
    const donePoints = Object.values(calibrationClicks).filter((c) => c >= CLICKS_PER_POINT).length;
    return (
      <section style={{ ...card, position: 'relative', background: 'var(--color-neutral-900)', minHeight: '420px', padding: '32px' }}>
        <button type="button" onClick={handleSkip} style={{ ...skipLink, color: 'var(--color-neutral-400)' }}>Skip this step →</button>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '8px', textAlign: 'center' }}>Calibration</p>
        <p style={{ color: 'var(--color-neutral-400)', fontSize: '0.88rem', textAlign: 'center', marginBottom: '28px' }}>
          Look at each green dot and click it {CLICKS_PER_POINT} times. <strong style={{ color: '#7C9A85' }}>{donePoints} / 9</strong> points done.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '420px', aspectRatio: '1', margin: '0 auto' }}>
          {Array.from({ length: 9 }, (_, index) => {
            const clicks = calibrationClicks[index] || 0;
            const done = clicks >= CLICKS_PER_POINT;
            return (
              <button
                key={index}
                type="button"
                disabled={done}
                onClick={(e) => handleCalibrationClick(index, e)}
                aria-label={`Calibration point ${index + 1}, ${clicks} of ${CLICKS_PER_POINT} clicks`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: done ? 'default' : 'pointer' }}
              >
                <span style={{
                  width: done ? '18px' : `${22 - clicks * 2}px`,
                  height: done ? '18px' : `${22 - clicks * 2}px`,
                  borderRadius: '50%',
                  backgroundColor: done ? 'var(--color-primary-dark)' : '#4ADE80',
                  boxShadow: done ? 'none' : '0 0 12px rgba(74,222,128,0.5)',
                  opacity: done ? 0.5 : 1 - clicks * 0.15,
                }} />
              </button>
            );
          })}
        </div>
        {preview(0.2)}
      </section>
    );
  }

  if (phase === 'validation') {
    const [fx, fy] = VALIDATION_TARGETS[validationIdx];
    return (
      <div role="dialog" aria-label="Calibration check" style={{ position: 'fixed', inset: 0, background: 'var(--color-neutral-900)', zIndex: 1000 }}>
        <p style={{ position: 'absolute', top: 24, width: '100%', textAlign: 'center', color: '#fff', fontWeight: 700 }}>
          Checking accuracy — look at the dot ({validationIdx + 1} / {VALIDATION_TARGETS.length})
        </p>
        <span style={{ position: 'absolute', left: `${fx * 100}%`, top: `${fy * 100}%`, width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: '50%', backgroundColor: '#4ADE80', boxShadow: '0 0 14px rgba(74,222,128,0.6)' }} />
      </div>
    );
  }

  if (phase === 'task') {
    const stim = STIMULI[currentStimulus] || STIMULI[0];
    return (
      <section style={{ position: 'relative', background: '#1A1A18', borderRadius: '20px', minHeight: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', userSelect: 'none' }}>
        <button type="button" onClick={handleSkip} style={{ ...skipLink, color: 'var(--color-neutral-400)' }}>Skip this step →</button>
        <div style={{ position: 'absolute', top: '16px', right: '80px', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, opacity: 0.85 }}>{countdown}s</div>
        <p style={{ color: 'var(--color-neutral-400)', fontSize: '0.85rem', marginBottom: '24px', fontWeight: 600 }}>Picture {currentStimulus + 1} / {STIMULI.length}</p>
        <div style={{ marginBottom: '20px' }}><StimulusSVG stimulus={stim} /></div>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.82rem', marginTop: '16px' }}>Just look at the pictures naturally.</p>
        {preview(0.15)}
      </section>
    );
  }

  if (phase === 'analyzing') {
    return (
      <section style={{ ...card, textAlign: 'center', padding: '56px 28px' }}>
        <div style={{ marginBottom: '18px' }}>{spinner(36)}</div>
        <p style={{ color: 'var(--color-neutral-700)', fontWeight: 600, fontSize: '1.05rem' }}>Checking gaze data quality…</p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.85rem', marginTop: '8px' }}>{sampleCount} gaze samples captured</p>
      </section>
    );
  }

  if (phase === 'result' && analysis) {
    const q = analysis.quality;
    if (analysis.status !== 'success') {
      const poor = analysis.status === 'insufficient_quality';
      return (
        <section style={{ ...card, borderColor: 'var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--color-risk-high)' }}>
            {poor ? 'Gaze data quality too low' : 'Gaze analysis not available'}
          </h3>
          <p role="alert" style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
            {reasonText(analysis.reason)} ({q.valid_sample_count} of {q.sample_count} samples usable, {q.duration_s}s.)
            {' '}Gaze will be reported as <strong>not available</strong>; it will not count as a low or high result.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            {poor && <button type="button" onClick={requestCamera} style={primaryBtn}>Repeat gaze step</button>}
            {!poor && <button type="button" onClick={runAnalysis} style={primaryBtn}>Retry analysis</button>}
            <button type="button" onClick={handleContinue} style={ghostBtn}>Continue without gaze result</button>
          </div>
        </section>
      );
    }
    return (
      <section style={card}>
        <h3 style={{ marginTop: 0, color: 'var(--color-neutral-900)' }}>Gaze session recorded</h3>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          {q.valid_sample_count} of {q.sample_count} samples were usable over {q.duration_s}s
          (calibration quality {q.calibration_score?.toFixed(2)}). The gaze model output will appear with your final results.
        </p>
        <button type="button" onClick={handleContinue} style={primaryBtn}>Continue</button>
      </section>
    );
  }

  return null;
}
