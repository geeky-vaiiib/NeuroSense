import { useCallback, useEffect, useRef, useState } from 'react';

/* ──────────────────────────────────────────────────────────────
   SVG Stimulus Faces — five simple variants
   ────────────────────────────────────────────────────────────── */
const STIMULI = [
  { id: 0, label: 'Happy face', mouth: 'smile', eyeDir: 'center', bg: '#FFD97D' },
  { id: 1, label: 'Neutral face', mouth: 'flat', eyeDir: 'center', bg: '#A8D8EA' },
  { id: 2, label: 'Looking-away face', mouth: 'flat', eyeDir: 'right', bg: '#C3B1E1' },
  { id: 3, label: 'No-eye-contact face', mouth: 'flat', eyeDir: 'down', bg: '#F8B4B4' },
  { id: 4, label: 'Crowd scene (abstract)', mouth: 'crowd', eyeDir: 'center', bg: '#B5EAD7' },
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
export default function GazeSession({ onComplete, onSkip, category }) {
  const [phase, setPhase] = useState('intro');
  const [stream, setStream] = useState(null);
  const [gazePoints, setGazePoints] = useState([]);
  const [countdown, setCountdown] = useState(30);
  const [permissionError, setPermissionError] = useState(null);
  const [calibrationClicks, setCalibrationClicks] = useState([]);
  const [currentStimulus, setCurrentStimulus] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const gazeRef = useRef([]);
  const timerRef = useRef(null);
  const samplerRef = useRef(null);
  const stimulusTimerRef = useRef(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const reduceMotion = typeof document !== 'undefined' && document.body.classList.contains('reduce-motion');

  /* ── Stop all media tracks ──────────────────────────────── */
  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  /* ── Cleanup on unmount ─────────────────────────────────── */
  useEffect(() => {
    return () => {
      stopStream();
      clearInterval(timerRef.current);
      clearInterval(samplerRef.current);
      clearTimeout(stimulusTimerRef.current);
    };
  }, [stopStream]);

  /* ── Attach stream to <video> when stream changes ───────── */
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, phase]);

  /* ── Request webcam ─────────────────────────────────────── */
  const requestCamera = async () => {
    setPhase('permission');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setPhase('calibration');
    } catch (err) {
      setPermissionError(err.message || 'Camera access was denied.');
      setPhase('error');
    }
  };

  /* ── Calibration click handler ──────────────────────────── */
  const handleCalibrationClick = (index) => {
    setCalibrationClicks((prev) => {
      if (prev.includes(index)) return prev;
      const next = [...prev, index];
      if (next.length === 9) {
        // All calibrated — start task after a short beat
        setTimeout(() => startTask(), 300);
      }
      return next;
    });
  };

  /* ── Start the 30-second task ───────────────────────────── */
  const startTask = () => {
    setPhase('task');
    setCountdown(30);
    setCurrentStimulus(0);
    gazeRef.current = [];

    // Countdown timer — tick every second
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          clearInterval(samplerRef.current);
          finishTask();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Stimulus rotation: change every 6 s
    let stimIdx = 0;
    const rotateStimulusStep = () => {
      stimIdx += 1;
      if (stimIdx < 5) {
        setCurrentStimulus(stimIdx);
        stimulusTimerRef.current = setTimeout(rotateStimulusStep, 6000);
      }
    };
    stimulusTimerRef.current = setTimeout(rotateStimulusStep, 6000);

    // Sample mouse/touch position every 100 ms
    samplerRef.current = setInterval(() => {
      const { x, y } = lastMousePos.current;
      const normX = Math.max(0, Math.min(x / window.innerWidth, 1));
      const normY = Math.max(0, Math.min(y / window.innerHeight, 1));
      gazeRef.current.push({ x: normX, y: normY, timestamp: Date.now(), stimulus: stimIdx });
    }, 100);
  };

  /* ── Finish task → processing ───────────────────────────── */
  const finishTask = () => {
    clearInterval(timerRef.current);
    clearInterval(samplerRef.current);
    clearTimeout(stimulusTimerRef.current);
    const data = [...gazeRef.current];
    setGazePoints(data);
    setPhase('processing');
    setTimeout(() => {
      stopStream();
      onComplete(data);
    }, 1500);
  };

  /* ── Skip helper ────────────────────────────────────────── */
  const handleSkip = () => {
    stopStream();
    clearInterval(timerRef.current);
    clearInterval(samplerRef.current);
    clearTimeout(stimulusTimerRef.current);
    onSkip();
  };

  /* ── Mouse / touch tracking (only during task) ──────────── */
  const handlePointerMove = (e) => {
    if (e.touches) {
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  /* ── Keyboard: Space to advance stimulus ────────────────── */
  useEffect(() => {
    if (phase !== 'task') return;
    const handler = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setCurrentStimulus((prev) => {
          if (prev < 4) return prev + 1;
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase]);

  /* ════════════════════════════════════════════════════════════
     RENDER — each phase
     ════════════════════════════════════════════════════════════ */

  /* ── INTRO ──────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <section style={{ ...card, position: 'relative' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)', marginBottom: '12px' }}>
          Gaze Session {category === 'child' ? '(Child)' : '(Adult)'}
        </h2>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7, maxWidth: '640px', marginBottom: '6px' }}>
          We will briefly activate your webcam to observe eye movement patterns during a short visual task.
          This takes <strong>30 seconds</strong>. Your video is <strong>not recorded or stored</strong>.
        </p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Mouse movement is used as a proxy for gaze tracking — no specialist hardware is required.
          You can skip this step at any time.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={requestCamera} style={primaryBtn}>Continue</button>
          <button type="button" onClick={handleSkip} style={ghostBtn}>Skip gaze step</button>
        </div>
      </section>
    );
  }

  /* ── PERMISSION (brief loading state) ───────────────────── */
  if (phase === 'permission') {
    return (
      <section style={{ ...card, position: 'relative', textAlign: 'center', padding: '48px 28px' }}>
        <button type="button" onClick={handleSkip} style={skipLink}>Skip this step →</button>
        <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: reduceMotion ? 'none' : 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--color-neutral-600)', marginTop: '16px', fontWeight: 600 }}>
          Requesting camera access…
        </p>
      </section>
    );
  }

  /* ── ERROR ───────────────────────────────────────────────── */
  if (phase === 'error') {
    return (
      <section style={{ ...card, position: 'relative', borderColor: 'var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--color-risk-high)', marginBottom: '10px' }}>
          Camera access denied
        </h3>
        <p style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7, marginBottom: '20px' }}>
          {permissionError || 'We were unable to access the webcam.'} You can still complete the screening without this step.
        </p>
        <button type="button" onClick={handleSkip} style={{ ...ghostBtn, borderColor: 'var(--color-risk-high-border)', color: 'var(--color-risk-high)' }}>
          Skip instead →
        </button>
      </section>
    );
  }

  /* ── CALIBRATION ────────────────────────────────────────── */
  if (phase === 'calibration') {
    const dotPositions = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        dotPositions.push({ row: r, col: c, index: r * 3 + c });
      }
    }
    return (
      <section style={{ ...card, position: 'relative', background: 'var(--color-neutral-900)', minHeight: '420px', padding: '32px' }}>
        <button type="button" onClick={handleSkip} style={{ ...skipLink, color: 'var(--color-neutral-400)' }}>Skip this step →</button>

        <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '8px', textAlign: 'center' }}>
          Calibration
        </p>
        <p style={{ color: 'var(--color-neutral-400)', fontSize: '0.88rem', textAlign: 'center', marginBottom: '28px' }}>
          Click each green dot to calibrate. <strong style={{ color: 'var(--clr-primary)' }}>{calibrationClicks.length} / 9</strong> points collected.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '420px', aspectRatio: '1', margin: '0 auto' }}>
          {dotPositions.map(({ index }) => {
            const clicked = calibrationClicks.includes(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleCalibrationClick(index)}
                aria-label={`Calibration point ${index + 1}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', cursor: clicked ? 'default' : 'pointer',
                }}
              >
                <span style={{
                  width: clicked ? '18px' : '22px',
                  height: clicked ? '18px' : '22px',
                  borderRadius: '50%',
                  backgroundColor: clicked ? 'var(--color-primary-dark)' : '#4ADE80',
                  boxShadow: clicked ? 'none' : '0 0 12px rgba(74,222,128,0.5)',
                  transition: reduceMotion ? 'none' : 'all 200ms ease',
                  opacity: clicked ? 0.5 : 1,
                }} />
              </button>
            );
          })}
        </div>

        {/* Webcam preview — bottom-right */}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '160px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      </section>
    );
  }

  /* ── TASK ────────────────────────────────────────────────── */
  if (phase === 'task') {
    const stim = STIMULI[currentStimulus] || STIMULI[0];
    return (
      <section
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
        style={{
          position: 'relative', background: '#1A1A18', borderRadius: '20px',
          minHeight: '480px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '32px',
          userSelect: 'none',
        }}
      >
        <button type="button" onClick={handleSkip} style={{ ...skipLink, color: 'var(--color-neutral-400)' }}>Skip this step →</button>

        {/* Countdown */}
        <div style={{ position: 'absolute', top: '16px', right: '80px', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, opacity: 0.85 }}>
          {countdown}s
        </div>

        {/* Stimulus counter */}
        <p style={{ color: 'var(--color-neutral-400)', fontSize: '0.85rem', marginBottom: '24px', fontWeight: 600 }}>
          Stimulus {currentStimulus + 1} / 5
        </p>

        {/* SVG Face */}
        <div style={{ transition: reduceMotion ? 'none' : 'opacity 400ms ease', marginBottom: '20px' }}>
          <StimulusSVG stimulus={stim} />
        </div>

        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.82rem', marginTop: '16px' }}>
          Move your cursor to follow what draws your attention. Press <kbd style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-neutral-600)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>Space</kbd> to advance.
        </p>

        {/* Webcam preview — bottom-right */}
        <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '160px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      </section>
    );
  }

  /* ── PROCESSING ─────────────────────────────────────────── */
  if (phase === 'processing') {
    return (
      <section style={{ ...card, textAlign: 'center', padding: '56px 28px' }}>
        <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: reduceMotion ? 'none' : 'spin 0.8s linear infinite', marginBottom: '18px' }} />
        <p style={{ color: 'var(--color-neutral-700)', fontWeight: 600, fontSize: '1.05rem' }}>
          Analysing gaze patterns…
        </p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.85rem', marginTop: '8px' }}>
          {gazePoints.length} data points collected
        </p>
      </section>
    );
  }

  return null;
}
