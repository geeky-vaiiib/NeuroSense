import { useCallback, useEffect, useRef, useState } from 'react';

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

const PROMPT_TEXT =
  'The quick brown fox jumps over the lazy dog. ' +
  'I enjoy spending time with my family and friends. ' +
  'Sometimes I find it hard to understand what people mean.';

/* ──────────────────────────────────────────────────────────────
   Preferred MIME type for MediaRecorder
   ────────────────────────────────────────────────────────────── */
function preferredMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg';
  return '';
}

/* ──────────────────────────────────────────────────────────────
   SpeechSession Component
   ────────────────────────────────────────────────────────────── */
export default function SpeechSession({ onComplete, onSkip, category }) {
  const [phase, setPhase] = useState('intro');
  const [countdown, setCountdown] = useState(20);
  const [preCountdown, setPreCountdown] = useState(3);
  const [transcriptHint, setTranscriptHint] = useState('');
  const [permissionError, setPermissionError] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const preTimerRef = useRef(null);
  const autoProceedRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const reduceMotion =
    typeof document !== 'undefined' &&
    document.body.classList.contains('reduce-motion');

  /* ── Stop all audio tracks ──────────────────────────────── */
  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  /* ── Full cleanup ───────────────────────────────────────── */
  const cleanup = useCallback(() => {
    stopStream();
    clearInterval(timerRef.current);
    clearInterval(preTimerRef.current);
    clearTimeout(autoProceedRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [stopStream]);

  useEffect(() => cleanup, [cleanup]);

  /* ── Skip helper ────────────────────────────────────────── */
  const handleSkip = useCallback(() => {
    cleanup();
    onSkip();
  }, [cleanup, onSkip]);

  /* ── Request microphone ─────────────────────────────────── */
  const requestMic = async () => {
    setPhase('permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;
      setPhase('prompt');
    } catch (err) {
      setPermissionError(err.message || 'Microphone access was denied.');
      setPhase('error');
    }
  };

  /* ── Pre-recording countdown (3-2-1) then start ─────────── */
  useEffect(() => {
    if (phase !== 'prompt') return;

    setPreCountdown(3);
    let count = 3;
    preTimerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(preTimerRef.current);
        startRecording();
      } else {
        setPreCountdown(count);
      }
    }, 1000);

    return () => clearInterval(preTimerRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Start MediaRecorder ────────────────────────────────── */
  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mime = preferredMime();
    const options = mime ? { mimeType: mime } : {};

    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mime || 'audio/webm',
      });
      setAudioBlob(blob);
    };

    recorder.start(250); // collect data every 250ms
    setPhase('recording');
    setCountdown(20);

    // Set up amplitude analyser if AudioContext is available
    setupAnalyser(stream);

    // 20-second recording timer
    let remaining = 20;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        stopRecording();
      }
    }, 1000);
  };

  /* ── Stop recording ─────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setCountdown(0);
    setPhase('done');

    // Auto-proceed after 5 seconds if user doesn't interact
    // Use a ref-based call so the timeout always sees the latest finishSession
    autoProceedRef.current = setTimeout(() => {
      finishSessionRef.current();
    }, 5000);
  }, []);

  /* ── Stop early ─────────────────────────────────────────── */
  const handleStopEarly = () => {
    stopRecording();
  };

  /* ── Finish session → processing → onComplete ──────────── */
  const finishSession = useCallback(() => {
    clearTimeout(autoProceedRef.current);
    setPhase('processing');
    setTimeout(() => {
      cleanup();
      const blob = audioBlob || new Blob(chunksRef.current, { type: preferredMime() || 'audio/webm' });
      onComplete(blob, transcriptHint);
    }, 2000);
  }, [audioBlob, cleanup, onComplete, transcriptHint]);

  // Keep a ref to finishSession so stopRecording's timeout always calls the latest version
  const finishSessionRef = useRef(finishSession);
  useEffect(() => {
    finishSessionRef.current = finishSession;
  }, [finishSession]);

  /* ── Amplitude visualiser (optional) ────────────────────── */
  const setupAnalyser = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      // AudioContext not available — skip visualiser
    }
  };

  const drawVisualiser = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(width / bufferLength, 2);
      const gap = 1;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const x = i * (barWidth + gap);
        const hue = 145; // sage-green hue
        const lightness = 40 + (dataArray[i] / 255) * 20;
        ctx.fillStyle = `hsl(${hue}, 30%, ${lightness}%)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      }
    };

    draw();
  }, []);

  useEffect(() => {
    if (phase === 'recording' && analyserRef.current && canvasRef.current) {
      drawVisualiser();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, drawVisualiser]);

  /* ════════════════════════════════════════════════════════════
     RENDER — each phase
     ════════════════════════════════════════════════════════════ */

  /* ── INTRO ──────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <section style={{ ...card, position: 'relative' }}>
        <h2
          style={{
            marginTop: 0,
            color: 'var(--color-neutral-900)',
            marginBottom: '12px',
          }}
        >
          Speech Sample{' '}
          <span style={{ fontWeight: 400, color: 'var(--color-neutral-400)' }}>
            (Optional)
          </span>
        </h2>
        <p
          style={{
            color: 'var(--color-neutral-600)',
            lineHeight: 1.7,
            maxWidth: '640px',
            marginBottom: '6px',
          }}
        >
          We will record <strong>20 seconds</strong> of speech to analyse vocal
          patterns. You do not need to say anything specific. You can describe
          what you did today, or read the prompt shown on screen.
        </p>
        <p
          style={{
            color: 'var(--color-neutral-500)',
            fontSize: '0.88rem',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          Your audio is processed on our server and is{' '}
          <strong>not stored</strong> after analysis.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={requestMic} style={primaryBtn}>
            Start recording
          </button>
          <button type="button" onClick={handleSkip} style={ghostBtn}>
            Skip this step →
          </button>
        </div>
      </section>
    );
  }

  /* ── PERMISSION (brief loading) ─────────────────────────── */
  if (phase === 'permission') {
    return (
      <section
        style={{
          ...card,
          position: 'relative',
          textAlign: 'center',
          padding: '48px 28px',
        }}
      >
        <button type="button" onClick={handleSkip} style={skipLink}>
          Skip this step →
        </button>
        <div
          style={{
            display: 'inline-block',
            width: 32,
            height: 32,
            border: '3px solid var(--color-primary)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: reduceMotion ? 'none' : 'spin 0.8s linear infinite',
          }}
        />
        <p
          style={{
            color: 'var(--color-neutral-600)',
            marginTop: '16px',
            fontWeight: 600,
          }}
        >
          Requesting microphone access…
        </p>
      </section>
    );
  }

  /* ── ERROR ───────────────────────────────────────────────── */
  if (phase === 'error') {
    return (
      <section
        style={{
          ...card,
          position: 'relative',
          borderColor: 'var(--color-risk-high-border)',
          backgroundColor: 'var(--color-risk-high-bg)',
        }}
      >
        <h3
          style={{
            marginTop: 0,
            color: 'var(--color-risk-high)',
            marginBottom: '10px',
          }}
        >
          Microphone access denied
        </h3>
        <p
          style={{
            color: 'var(--color-neutral-700)',
            lineHeight: 1.7,
            marginBottom: '20px',
          }}
        >
          {permissionError || 'We were unable to access the microphone.'} You
          can still complete the screening without this step.
        </p>
        <button
          type="button"
          onClick={handleSkip}
          style={{
            ...ghostBtn,
            borderColor: 'var(--color-risk-high-border)',
            color: 'var(--color-risk-high)',
          }}
        >
          Skip instead →
        </button>
      </section>
    );
  }

  /* ── PROMPT (3-second pre-countdown) ────────────────────── */
  if (phase === 'prompt') {
    return (
      <section style={{ ...card, position: 'relative' }}>
        <button type="button" onClick={handleSkip} style={skipLink}>
          Skip this step →
        </button>

        <h3
          style={{
            marginTop: 0,
            color: 'var(--color-neutral-900)',
            marginBottom: '16px',
          }}
        >
          Read or speak freely
        </h3>
        <p
          style={{
            color: 'var(--color-neutral-600)',
            lineHeight: 1.7,
            marginBottom: '18px',
          }}
        >
          Please describe what you did today, or read this text out loud:
        </p>
        <blockquote
          style={{
            margin: '0 0 28px',
            padding: '20px 24px',
            borderRadius: '16px',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-neutral-200)',
            fontSize: '1.1rem',
            lineHeight: 1.8,
            color: 'var(--color-neutral-800)',
            fontStyle: 'italic',
          }}
        >
          &ldquo;{PROMPT_TEXT}&rdquo;
        </blockquote>

        <div
          aria-live="polite"
          style={{
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-primary-dark)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Recording starts in {preCountdown}…
        </div>
      </section>
    );
  }

  /* ── RECORDING ──────────────────────────────────────────── */
  if (phase === 'recording') {
    const elapsed = 20 - countdown;
    const progressPct = Math.min((elapsed / 20) * 100, 100);

    return (
      <section
        style={{
          ...card,
          position: 'relative',
          background: '#1A1A18',
          color: '#fff',
        }}
      >
        <button
          type="button"
          onClick={handleSkip}
          style={{ ...skipLink, color: 'var(--color-neutral-400)' }}
        >
          Skip this step →
        </button>

        {/* Recording indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              boxShadow: '0 0 8px rgba(239,68,68,0.6)',
              animation: reduceMotion
                ? 'none'
                : 'speechPulse 1.2s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Recording…
          </span>
        </div>

        {/* Countdown timer */}
        <div
          aria-live="polite"
          style={{
            textAlign: 'center',
            fontSize: '2.5rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            marginBottom: '12px',
            color: countdown <= 5 ? '#EF4444' : '#fff',
            transition: reduceMotion ? 'none' : 'color 300ms ease',
          }}
        >
          {countdown}s
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: '8px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              borderRadius: '999px',
              backgroundColor: 'var(--color-primary)',
              transition: reduceMotion ? 'none' : 'width 1s linear',
            }}
          />
        </div>

        {/* Amplitude visualiser */}
        <canvas
          ref={canvasRef}
          width={400}
          height={60}
          style={{
            width: '100%',
            height: '60px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            marginBottom: '16px',
          }}
        />

        {/* Prompt reminder */}
        <p
          style={{
            color: 'var(--color-neutral-400)',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            textAlign: 'center',
            marginBottom: '18px',
          }}
        >
          &ldquo;{PROMPT_TEXT}&rdquo;
        </p>

        {/* Stop early button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={handleStopEarly}
            style={{
              ...ghostBtn,
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'var(--color-neutral-300)',
              fontSize: '0.85rem',
            }}
          >
            Stop early →
          </button>
        </div>

        {/* Pulsing animation keyframes (injected once) */}
        <style>{`
          @keyframes speechPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.5; transform: scale(1.3); }
          }
        `}</style>
      </section>
    );
  }

  /* ── DONE (transcript input before processing) ──────────── */
  if (phase === 'done') {
    return (
      <section style={{ ...card, position: 'relative' }}>
        <button type="button" onClick={handleSkip} style={skipLink}>
          Skip this step →
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <h3 style={{ margin: 0, color: 'var(--color-neutral-900)' }}>
            Recording complete
          </h3>
        </div>

        <p
          style={{
            color: 'var(--color-neutral-600)',
            lineHeight: 1.7,
            marginBottom: '16px',
          }}
        >
          Your 20-second speech sample has been captured. Optionally type what
          you said to improve the analysis accuracy.
        </p>

        <label
          style={{
            display: 'block',
            marginBottom: '18px',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--color-neutral-500)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Optional: type what you said
          </span>
          <textarea
            value={transcriptHint}
            onChange={(e) => {
              setTranscriptHint(e.target.value);
              // Reset auto-proceed when user types
              clearTimeout(autoProceedRef.current);
              autoProceedRef.current = setTimeout(() => finishSession(), 8000);
            }}
            placeholder="This helps improve analysis accuracy…"
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--color-neutral-200)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-neutral-800)',
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={finishSession} style={primaryBtn}>
            Done →
          </button>
        </div>

        <p
          style={{
            marginTop: '10px',
            fontSize: '0.78rem',
            color: 'var(--color-neutral-400)',
          }}
        >
          Will auto-proceed in a few seconds if no input is provided.
        </p>
      </section>
    );
  }

  /* ── PROCESSING ─────────────────────────────────────────── */
  if (phase === 'processing') {
    return (
      <section
        style={{ ...card, textAlign: 'center', padding: '56px 28px' }}
      >
        <div
          style={{
            display: 'inline-block',
            width: 36,
            height: 36,
            border: '3px solid var(--color-primary)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: reduceMotion ? 'none' : 'spin 0.8s linear infinite',
            marginBottom: '18px',
          }}
        />
        <p
          style={{
            color: 'var(--color-neutral-700)',
            fontWeight: 600,
            fontSize: '1.05rem',
          }}
        >
          Uploading and analysing speech patterns…
        </p>
        <p
          style={{
            color: 'var(--color-neutral-500)',
            fontSize: '0.85rem',
            marginTop: '8px',
          }}
        >
          This usually takes a few seconds.
        </p>
      </section>
    );
  }

  return null;
}
