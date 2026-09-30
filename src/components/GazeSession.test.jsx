import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({ gazeApi: { analyze: vi.fn(), status: vi.fn() } }));
vi.mock('../gaze/tracker', () => {
  class TrackerError extends Error { constructor(code, message) { super(message); this.name = 'TrackerError'; this.code = code; } }
  const ctl = { instance: null, startError: null };
  class FaceTracker {
    constructor(cb) { this.cb = cb; ctl.instance = this; this.stopped = false; }
    async start() { if (ctl.startError) throw ctl.startError; return { w: 640, h: 480 }; }
    stop() { this.stopped = true; }
  }
  return { FaceTracker, TrackerError, LOW_LIGHT: 45, __ctl: ctl };
});

import { gazeApi } from '../services/api';
import * as trackerMod from '../gaze/tracker';
import { TARGETS } from '../gaze/calibration';
import GazeSession from './GazeSession';

const ctl = trackerMod.__ctl;
const OK_RESULT = {
  modality: 'gaze', status: 'success', probability: 0.4321, model_status: 'trained',
  quality: { valid: true, sample_count: 700, valid_sample_count: 690, valid_ratio: 0.98, calibration_score: 0.8, duration_s: 29.9, warnings: [] },
};

const flush = async (ms) => {                    // small act() steps so React commits between timer callbacks
  for (let t = 0; t < ms; t += 100) await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(100, ms - t)); });
};
const frame = (over = {}) => ({ t: performance.now(), ok: true, reason: null, features: [0, 0, 0, 0, 0.5, 0.5], landmarks: null, fps: 30, luma: 130, ...over });
const emit = (over) => act(() => { ctl.instance.cb(frame(over)); });

/** Streams frames at ~30 Hz; `make()` returns frame overrides (or null for "no frame"). */
function startDriver(make) {
  const id = setInterval(() => { const o = make(); if (o && ctl.instance) ctl.instance.cb(frame(o)); }, 33);
  return () => clearInterval(id);
}
const targetFeatures = () => {                    // follow the on-screen calibration point like a real eye would
  const m = document.body.textContent.match(/POINT (\d) OF/);
  const [tx, ty] = TARGETS[(m ? Number(m[1]) : 1) - 1];
  return { features: [(tx - 0.5) * 0.5, (ty - 0.5) * 0.4, 0, 0, 0.5, 0.5] };
};

async function toSetup() {
  render(<GazeSession category="child" onComplete={vi.fn()} onSkip={vi.fn()} />);
  await flush(100);
  fireEvent.click(screen.getByText('Start camera check'));
  await flush(300);
}

describe('GazeSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    ctl.instance = null; ctl.startError = null;
    gazeApi.status.mockResolvedValue({ available: true, model_version: 'gaze-test', reason: null });
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => 'uuid-test' });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ clearRect() {}, beginPath() {}, arc() {}, fill() {} }));
  });
  afterEach(() => vi.useRealTimers());

  it('checks the model first and refuses to start when it is unavailable', async () => {
    gazeApi.status.mockResolvedValue({ available: false, reason: 'torch_not_installed' });
    const onSkip = vi.fn();
    render(<GazeSession category="child" onComplete={vi.fn()} onSkip={onSkip} />);
    await flush(100);
    expect(screen.getByRole('status', { name: '' })).toBeDefined();
    expect(screen.getByText(/Gaze model unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Start camera check')).toBeDisabled();
    fireEvent.click(screen.getByText(/Continue without gaze \(model unavailable\)/));
    expect(onSkip).toHaveBeenCalledWith('model_unavailable');
  });

  it('camera permission denied -> explicit code, retry, never "skipped"', async () => {
    ctl.startError = new trackerMod.TrackerError('CAMERA_PERMISSION_DENIED', 'Camera permission was denied.');
    const onSkip = vi.fn();
    render(<GazeSession category="child" onComplete={vi.fn()} onSkip={onSkip} />);
    await flush(100);
    fireEvent.click(screen.getByText('Start camera check'));
    await flush(300);
    expect(screen.getByText('Camera permission denied')).toBeInTheDocument();
    expect(screen.getByText('CAMERA_PERMISSION_DENIED')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(onSkip).not.toHaveBeenCalled();
    expect(gazeApi.analyze).not.toHaveBeenCalled();
  });

  it('does not allow calibration until a face is detected and steady, and says what is wrong', async () => {
    await toSetup();
    expect(screen.getByText('Begin calibration')).toBeDisabled();
    await emit({ ok: false, reason: 'FACE_TOO_FAR', features: null });
    await flush(300);
    await emit({ ok: false, reason: 'FACE_TOO_FAR', features: null });
    expect(screen.getAllByText(/Move closer to the camera/).length).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) await emit({ t: performance.now() + i });
    await flush(300);
    await emit();
    expect(screen.getByText('Begin calibration')).not.toBeDisabled();
  });

  async function calibrate(driver) {
    await toSetup();
    const stop0 = startDriver(() => frame());
    await flush(700);
    stop0();
    fireEvent.click(screen.getByText('Begin calibration'));
    const stop = startDriver(driver);
    await flush(30_000);
    stop();
  }

  it('accepts a clean calibration, then runs the timed task and sends the canonical payload', async () => {
    await calibrate(targetFeatures);
    expect(screen.getByText(/CALIBRATION COMPLETE/)).toBeInTheDocument();
    expect(screen.getByText(/READY/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Start the 30-second task'));
    const stop = startDriver(() => ({ features: [0.02, 0.01, 0, 0, 0.5, 0.5] }));
    await flush(1000);
    expect(screen.getByRole('timer')).toHaveTextContent(/GAZE ANALYSIS · 00:0[01] \/ 00:30/);   // real elapsed time
    gazeApi.analyze.mockResolvedValue(OK_RESULT);
    await flush(30_000);
    stop();
    expect(gazeApi.analyze).toHaveBeenCalledTimes(1);
    const p = gazeApi.analyze.mock.calls[0][0];
    expect(Object.keys(p).sort()).toEqual(['calibration', 'category', 'samples', 'screen_height', 'screen_width', 'session_id']);
    expect(p.calibration).toMatchObject({ completed: true, method: 'mediapipe_iris_ridge_9pt_auto' });
    expect(p.calibration.quality_score).toBeGreaterThan(0.3);
    expect(p.samples.length).toBeGreaterThan(300);
    expect(Object.keys(p.samples[0]).sort()).toEqual(['face_detected', 'stimulus_id', 'timestamp', 'x', 'y']);
    const ts = p.samples.map((s) => s.timestamp);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));                          // strictly ordered
    expect(screen.getByText('Gaze session recorded')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/43%|0\.4321/);              // the UI never shows a client-side score
  });

  it('a slow device (about 8 frames/s) is given time to collect enough frames instead of failing', async () => {
    await toSetup();
    const s0 = startDriver(() => frame());
    await flush(700);
    s0();
    fireEvent.click(screen.getByText('Begin calibration'));
    const id = setInterval(() => { if (ctl.instance) ctl.instance.cb(frame(targetFeatures())); }, 125);
    await flush(60_000);
    clearInterval(id);
    expect(screen.getByText(/CALIBRATION COMPLETE/)).toBeInTheDocument();
  });

  it('holds calibration when the face is lost instead of failing the session', async () => {
    await toSetup();
    const s0 = startDriver(() => frame());
    await flush(700);
    s0();
    fireEvent.click(screen.getByText('Begin calibration'));
    let lostUntil = 2500;
    let elapsed = 0;
    const stop = startDriver(() => { elapsed += 33; return elapsed < lostUntil ? { ok: false, reason: 'FACE_NOT_DETECTED', features: null } : targetFeatures(); });
    await flush(1500);
    expect(screen.getByText(/FACE LOST/)).toBeInTheDocument();
    expect(screen.queryByText(/NEEDS IMPROVEMENT/)).not.toBeInTheDocument();
    lostUntil = 0;
    await flush(30_000);
    stop();
    expect(screen.getByText(/CALIBRATION COMPLETE/)).toBeInTheDocument();
  });

  it('rejects an inaccurate calibration with a reason and offers recalibration (no skip on attempt 1)', async () => {
    let n = 0;
    await calibrate(() => { n += 1; return { features: [Math.sin(n) * 0.4, Math.cos(n * 1.7) * 0.4, 0, 0, 0.5, 0.5] }; });   // eye does not follow the dots
    expect(screen.getByText(/CALIBRATION NEEDS IMPROVEMENT/)).toBeInTheDocument();
    expect(screen.getByText('Recalibrate')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Attempt 1 of 3/);
    expect(screen.queryByText(/Skip the gaze step/)).not.toBeInTheDocument();
    expect(gazeApi.analyze).not.toHaveBeenCalled();
  });

  it('too few samples in the task -> INSUFFICIENT_DATA, model never called', async () => {
    await calibrate(targetFeatures);
    fireEvent.click(screen.getByText('Start the 30-second task'));
    await flush(31_000);                                                         // no frames at all
    expect(screen.getByText('INSUFFICIENT_DATA')).toBeInTheDocument();
    expect(screen.getByText('Insufficient gaze data')).toBeInTheDocument();
    expect(gazeApi.analyze).not.toHaveBeenCalled();
  });

  it('backend unreachable -> explicit error with retry, no fabricated result', async () => {
    await calibrate(targetFeatures);
    fireEvent.click(screen.getByText('Start the 30-second task'));
    const stop = startDriver(() => ({ features: [0.02, 0.01, 0, 0, 0.5, 0.5] }));
    gazeApi.analyze.mockRejectedValue(Object.assign(new Error('Unable to connect'), { kind: 'network' }));
    await flush(31_000);
    stop();
    expect(screen.getByText('Analysis server unreachable')).toBeInTheDocument();
    expect(screen.getByText('Retry analysis')).toBeInTheDocument();
  });

  it('shows the backend reason when the session is not scorable (never a score)', async () => {
    await calibrate(targetFeatures);
    fireEvent.click(screen.getByText('Start the 30-second task'));
    const stop = startDriver(() => ({ features: [0.02, 0.01, 0, 0, 0.5, 0.5] }));
    gazeApi.analyze.mockResolvedValue({ ...OK_RESULT, status: 'insufficient_quality', probability: null, reason: 'insufficient_valid_samples', error_code: 'GAZE_SESSION_QUALITY_INSUFFICIENT', quality: { ...OK_RESULT.quality, valid: false } });
    await flush(31_000);
    stop();
    expect(screen.getByText('GAZE_SESSION_QUALITY_INSUFFICIENT')).toBeInTheDocument();
    expect(screen.getByText('Repeat gaze test')).toBeInTheDocument();
  });

  it('releases the camera on unmount', async () => {
    const { unmount } = render(<GazeSession category="child" onComplete={vi.fn()} onSkip={vi.fn()} />);
    await flush(100);
    fireEvent.click(screen.getByText('Start camera check'));
    await flush(300);
    const inst = ctl.instance;
    unmount();
    expect(inst.stopped).toBe(true);
  });
});
