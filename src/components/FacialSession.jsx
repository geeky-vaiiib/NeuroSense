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

export default function FacialSession({ onComplete, onSkip, category }) {
  const [phase, setPhase] = useState('intro');
  const [stream, setStream] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [countdown, setCountdown] = useState(5);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const reduceMotion = typeof document !== 'undefined' && document.body.classList.contains('reduce-motion');

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      clearInterval(timerRef.current);
    };
  }, [stopStream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, phase]);

  const requestCamera = async () => {
    setPhase('permission');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setPhase('task');
      startTask();
    } catch (camErr) {
      const msg = camErr.name === 'NotAllowedError'
          ? 'Camera permission was denied.'
          : 'Unable to access the camera.';
      setPermissionError(msg);
      setPhase('error');
    }
  };

  const startTask = () => {
    setCountdown(5);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          captureAndFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const captureAndFinish = () => {
    setPhase('processing');
    let base64Image = null;
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      // Draw centered crop
      const video = videoRef.current;
      const size = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;
      ctx.drawImage(video, startX, startY, size, size, 0, 0, 128, 128);
      base64Image = canvas.toDataURL('image/jpeg', 0.8);
    }
    
    setTimeout(() => {
      stopStream();
      onComplete(base64Image);
    }, 1000);
  };

  const handleSkip = () => {
    stopStream();
    clearInterval(timerRef.current);
    onSkip();
  };

  if (phase === 'intro') {
    return (
      <section style={{ ...card, position: 'relative' }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-neutral-900)', marginBottom: '12px' }}>
          Facial Expression Session {category === 'child' ? '(Child)' : '(Adult)'}
        </h2>
        <p style={{ color: 'var(--color-neutral-600)', lineHeight: 1.7, maxWidth: '640px', marginBottom: '6px' }}>
          We will briefly use your webcam to capture facial expression data for affective analysis.
          Your video is <strong>not recorded or stored</strong>.
        </p>
        <p style={{ color: 'var(--color-neutral-500)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Ensure you are in a well-lit room and facing the camera directly.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={requestCamera} style={primaryBtn}>Continue</button>
          <button type="button" onClick={handleSkip} style={ghostBtn}>Skip facial step</button>
        </div>
      </section>
    );
  }

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

  if (phase === 'error') {
    return (
      <section style={{ ...card, position: 'relative', borderColor: 'var(--color-risk-high-border)', backgroundColor: 'var(--color-risk-high-bg)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--color-risk-high)', marginBottom: '10px' }}>
          Camera access denied
        </h3>
        <p style={{ color: 'var(--color-neutral-700)', lineHeight: 1.7, marginBottom: '20px' }}>
          {permissionError} You can still complete the screening without this step.
        </p>
        <button type="button" onClick={handleSkip} style={{ ...ghostBtn, borderColor: 'var(--color-risk-high-border)', color: 'var(--color-risk-high)' }}>
          Skip instead →
        </button>
      </section>
    );
  }

  if (phase === 'task') {
    return (
      <section style={{ ...card, position: 'relative', textAlign: 'center', background: '#1A1A18', minHeight: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <button type="button" onClick={handleSkip} style={{ ...skipLink, color: 'var(--color-neutral-400)' }}>Skip this step →</button>
        
        <div style={{ position: 'absolute', top: '16px', right: '80px', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, opacity: 0.85 }}>
          {countdown}s
        </div>
        
        <p style={{ color: 'var(--color-neutral-300)', marginBottom: '24px' }}>
          Please look naturally into the camera.
        </p>

        <div style={{ width: '320px', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      </section>
    );
  }

  if (phase === 'processing') {
    return (
      <section style={{ ...card, textAlign: 'center', padding: '56px 28px' }}>
        <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid var(--color-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: reduceMotion ? 'none' : 'spin 0.8s linear infinite', marginBottom: '18px' }} />
        <p style={{ color: 'var(--color-neutral-700)', fontWeight: 600, fontSize: '1.05rem' }}>
          Analysing facial expressions…
        </p>
      </section>
    );
  }

  return null;
}
