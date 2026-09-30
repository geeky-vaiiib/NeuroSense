/**
 * Camera + MediaPipe FaceMesh lifecycle.
 *
 * - ONE camera stream and ONE FaceMesh instance per page (module singleton); start()/stop() are
 *   idempotent and StrictMode-safe.
 * - Frames are processed only after: video has metadata + readyState>=2 + non-zero size, AND FaceMesh
 *   has finished initialize(). A processing guard prevents overlapping send() calls (no queue build-up).
 * - Every failure is an explicit TrackerError with a machine-readable `code`.
 */
import { extractFeatures } from './landmarks';

export class TrackerError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'TrackerError';
    this.code = code;
    this.cause = cause;
  }
}

export const CODES = {
  CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
  NO_CAMERA: 'NO_CAMERA',
  CAMERA_IN_USE: 'CAMERA_IN_USE',
  CAMERA_ERROR: 'CAMERA_ERROR',
  INSECURE_CONTEXT: 'INSECURE_CONTEXT',
  VIDEO_NOT_READY: 'VIDEO_NOT_READY',
  MODEL_LOAD_FAILED: 'FACE_MODEL_LOAD_FAILED',
};

export const MEDIAPIPE_BASE = '/mediapipe/face_mesh/';
const MAX_FPS = 30;
const LIGHT_EVERY_MS = 600;
export const LOW_LIGHT = 45;                 // mean luma (0-255) below which detection degrades

const VIDEO_CONSTRAINTS = {
  video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

/* ── FaceMesh singleton ───────────────────────────────────────────────────── */
let scriptPromise = null;
let meshPromise = null;
let mesh = null;
let onMeshResults = null;

function loadScript() {
  if (window.FaceMesh) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${MEDIAPIPE_BASE}face_mesh.js`;
      s.async = true;
      s.onload = () => (window.FaceMesh ? resolve() : reject(new Error('face_mesh.js loaded but FaceMesh is undefined')));
      s.onerror = () => reject(new Error(`could not load ${s.src}`));
      document.head.appendChild(s);
    }).catch((e) => { scriptPromise = null; throw e; });
  }
  return scriptPromise;
}

export function ensureFaceMesh() {
  if (!meshPromise) {
    meshPromise = (async () => {
      await loadScript();
      const fm = new window.FaceMesh({ locateFile: (f) => `${MEDIAPIPE_BASE}${f}` });
      fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      fm.onResults((r) => onMeshResults?.(r));
      await fm.initialize();               // frames are never sent before this resolves
      mesh = fm;
      return fm;
    })().catch((e) => {
      meshPromise = null;
      throw new TrackerError(CODES.MODEL_LOAD_FAILED, 'The face-tracking model could not be loaded.', e);
    });
  }
  return meshPromise;
}

/* ── Camera ───────────────────────────────────────────────────────────────── */
export async function openCamera() {
  if (!window.isSecureContext) {
    throw new TrackerError(CODES.INSECURE_CONTEXT, 'Camera access needs HTTPS (or localhost).');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new TrackerError(CODES.NO_CAMERA, 'This browser does not support camera access.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
  } catch (e) {
    const n = e?.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') throw new TrackerError(CODES.CAMERA_PERMISSION_DENIED, 'Camera permission was denied.', e);
    if (n === 'NotFoundError' || n === 'OverconstrainedError') throw new TrackerError(CODES.NO_CAMERA, 'No camera was found.', e);
    if (n === 'NotReadableError' || n === 'AbortError') throw new TrackerError(CODES.CAMERA_IN_USE, 'The camera is in use by another application.', e);
    throw new TrackerError(CODES.CAMERA_ERROR, e?.message || 'The camera could not be started.', e);
  }
}

/** Resolve once the <video> is really producing frames. */
export function waitForVideo(video, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const check = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) { resolve({ w: video.videoWidth, h: video.videoHeight }); return; }
      if (performance.now() - t0 > timeoutMs) { reject(new TrackerError(CODES.VIDEO_NOT_READY, 'The camera did not deliver any video frames.')); return; }
      setTimeout(check, 50);
    };
    check();
  });
}

/* ── Tracker session ──────────────────────────────────────────────────────── */
export class FaceTracker {
  /**
   * @param onFrame ({ t, ok, reason, features, openness, faceWidth, center, landmarks, fps, luma }) => void
   */
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.stream = null;
    this.video = null;
    this.running = false;
    this.busy = false;
    this.lastSend = 0;
    this.fpsWin = [];
    this.luma = null;
    this.lastLuma = 0;
    this.canvas = null;
  }

  async start(video) {
    if (this.running) return { w: video.videoWidth, h: video.videoHeight };
    this.video = video;
    this.stream = await openCamera();
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    try { await video.play(); } catch { /* autoplay flag usually suffices; readiness is verified below */ }
    const size = await waitForVideo(video);
    await ensureFaceMesh();                 // never process before the model is ready
    this.running = true;
    onMeshResults = (res) => this.handleResults(res);
    this.loop();
    return size;
  }

  loop = () => {
    if (!this.running) return;
    const v = this.video;
    const step = async (now) => {
      if (!this.running) return;
      if (!this.busy && now - this.lastSend >= 1000 / MAX_FPS && v.readyState >= 2 && v.videoWidth > 0) {
        this.busy = true;
        this.lastSend = now;
        this.sampleLight(now);
        try { await mesh.send({ image: v }); } catch (e) { this.onFrame?.({ t: performance.now(), ok: false, reason: 'PROCESSING_ERROR', error: e }); }
        this.busy = false;
      }
      this.schedule(step);
    };
    this.schedule(step);
  };

  schedule(fn) {
    if (this.video?.requestVideoFrameCallback) this.video.requestVideoFrameCallback((now) => fn(now));
    else this.raf = requestAnimationFrame(fn);
  }

  sampleLight(now) {
    if (now - this.lastLuma < LIGHT_EVERY_MS) return;
    this.lastLuma = now;
    if (!this.canvas) { this.canvas = document.createElement('canvas'); this.canvas.width = 32; this.canvas.height = 24; }
    try {
      const c = this.canvas.getContext('2d', { willReadFrequently: true });
      c.drawImage(this.video, 0, 0, 32, 24);
      const d = c.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      this.luma = sum / (d.length / 4);
    } catch { /* tainted/unsupported: leave luma unknown */ }
  }

  handleResults(res) {
    const t = performance.now();
    this.fpsWin.push(t);
    while (this.fpsWin.length && t - this.fpsWin[0] > 1000) this.fpsWin.shift();
    const lm = res?.multiFaceLandmarks?.[0];
    const aspect = this.video.videoWidth / this.video.videoHeight;
    const f = extractFeatures(lm, aspect);
    this.onFrame?.({ t, ...f, landmarks: lm || null, fps: this.fpsWin.length, luma: this.luma });
  }

  /** Release the camera and stop the loop. FaceMesh itself is kept (single shared instance). */
  stop() {
    this.running = false;
    onMeshResults = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((tr) => tr.stop());
    if (this.video) this.video.srcObject = null;
    this.stream = null;
  }
}
