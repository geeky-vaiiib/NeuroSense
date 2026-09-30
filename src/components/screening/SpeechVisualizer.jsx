/**
 * Live microphone visualizer. Draws mirrored frequency bars from the real AnalyserNode and reports
 * an input-level label computed from the same data (no simulated values). With no analyser, or
 * with reduced motion, it renders a still baseline.
 */
import { useEffect, useRef, useState } from 'react';

export default function SpeechVisualizer({ analyserRef, reduced = false, height = 84 }) {
  const canvasRef = useRef(null);
  const [level, setLevel] = useState(null); // null until measured

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef?.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const drawBaseline = () => {
      ctx.clearRect(0, 0, w, height);
      ctx.fillStyle = 'rgba(148,163,184,0.35)';
      ctx.fillRect(0, height / 2 - 0.5, w, 1);
    };
    if (!analyser || reduced) {
      drawBaseline();
      if (!analyser) return undefined;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let lastLevelAt = 0;
    const bars = 48;
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      if (!reduced) {
        ctx.clearRect(0, 0, w, height);
        const gap = 3;
        const bw = (w / 2 - gap * bars / 2) / (bars / 2);
        for (let i = 0; i < bars / 2; i++) {
          const v = data[Math.floor((i / (bars / 2)) * data.length * 0.75)] / 255;
          const bh = Math.max(3, v * height * 0.95);
          const grad = ctx.createLinearGradient(0, height / 2 - bh / 2, 0, height / 2 + bh / 2);
          grad.addColorStop(0, '#22D3EE');
          grad.addColorStop(1, '#5EEAD4');
          ctx.fillStyle = grad;
          const xr = w / 2 + i * (bw + gap);
          const xl = w / 2 - (i + 1) * (bw + gap) + gap;
          ctx.beginPath();
          ctx.roundRect?.(xr, height / 2 - bh / 2, bw, bh, 2) ?? ctx.rect(xr, height / 2 - bh / 2, bw, bh);
          ctx.roundRect?.(xl, height / 2 - bh / 2, bw, bh, 2) ?? ctx.rect(xl, height / 2 - bh / 2, bw, bh);
          ctx.fill();
        }
      }
      if (t - lastLevelAt > 300) {
        lastLevelAt = t;
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(sum / data.length / 255);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, reduced, height]);

  const label = level === null ? 'Waiting for signal' : level < 0.03 ? 'Very quiet — speak closer to the microphone' : level < 0.08 ? 'Low input level' : 'Good input level';
  const tone = level === null ? '#8FA3C0' : level < 0.03 ? '#FCA5A5' : level < 0.08 ? '#FCD34D' : '#5EEAD4';

  return (
    <div>
      <canvas ref={canvasRef} role="img" aria-label="Live audio waveform" style={{ width: '100%', height, display: 'block', borderRadius: 12, background: 'rgba(148,163,184,0.06)' }} />
      <p role="status" style={{ marginTop: 10, fontSize: '0.78rem', color: tone, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'none' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} aria-hidden="true" />
        {label}
      </p>
    </div>
  );
}
