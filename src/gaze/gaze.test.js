import { describe, it, expect } from 'vitest';
import { extractFeatures, FEATURE_NAMES, IDX, LIMITS, FACE_REASONS } from './landmarks';
import { fit, predict, crossValidate, solve } from './mapper';
import { GazeSmoother, rejectOutliers } from './filters';
import { assessCalibration, TARGETS, MIN_FRAMES_PER_TARGET, MAX_MEAN_ERR_FRAC } from './calibration';

const ASPECT = 16 / 9;

/** Synthetic FaceMesh output: a frontal face with the iris shifted by (gx, gy) eye-widths. */
function face({ gx = 0, gy = 0, yaw = 0, cx = 0.5, cy = 0.5, width = 0.4, open = 0.3, count = 478 } = {}) {
  const lm = Array.from({ length: count }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i, x, y) => { if (i < count) lm[i] = { x, y, z: 0 }; };
  const eyeW = 0.09, eyeH = eyeW * open;
  const ey = cy - 0.05;
  const lc = cx - 0.09, rc = cx + 0.09;                              // eye centres
  set(IDX.L_OUTER, lc - eyeW / 2, ey); set(IDX.L_INNER, lc + eyeW / 2, ey);
  set(IDX.R_INNER, rc - eyeW / 2, ey); set(IDX.R_OUTER, rc + eyeW / 2, ey);
  set(IDX.L_TOP, lc, ey - eyeH / 2); set(IDX.L_BOTTOM, lc, ey + eyeH / 2);
  set(IDX.R_TOP, rc, ey - eyeH / 2); set(IDX.R_BOTTOM, rc, ey + eyeH / 2);
  set(IDX.IRIS_A, lc + gx * eyeW, ey + gy * eyeW * ASPECT);   // y is normalised by height, so scale by aspect
  set(IDX.IRIS_B, rc + gx * eyeW, ey + gy * eyeW * ASPECT);
  set(IDX.L_CHEEK, cx - width / 2, cy); set(IDX.R_CHEEK, cx + width / 2, cy);
  set(IDX.NOSE, cx + yaw * width, cy + 0.02);
  return lm;
}

describe('landmark features', () => {
  it('feature order is the canonical schema', () => {
    expect(FEATURE_NAMES).toEqual(['gx', 'gy', 'yaw', 'pitch', 'cx', 'cy']);
    const r = extractFeatures(face(), ASPECT);
    expect(r.ok).toBe(true);
    expect(r.features).toHaveLength(FEATURE_NAMES.length);
  });

  it('iris shift maps to gx/gy with the right sign and scale', () => {
    const c = extractFeatures(face(), ASPECT).features;
    const right = extractFeatures(face({ gx: 0.2 }), ASPECT).features;
    const down = extractFeatures(face({ gy: 0.15 }), ASPECT).features;
    expect(right[0] - c[0]).toBeCloseTo(0.2, 1);      // +x = iris toward image-right, in eye widths
    expect(down[1] - c[1]).toBeCloseTo(0.15, 1);      // +y = downward
    expect(Math.abs(right[1] - c[1])).toBeLessThan(0.02);
  });

  it('rejects unusable frames with explicit reasons', () => {
    expect(extractFeatures(null, ASPECT).reason).toBe(FACE_REASONS.NO_LANDMARKS);
    expect(extractFeatures(face({ count: 468 }), ASPECT).reason).toBe(FACE_REASONS.INCOMPLETE);   // no iris refinement
    expect(extractFeatures(face({ width: 0.1 }), ASPECT).reason).toBe(FACE_REASONS.TOO_FAR);
    expect(extractFeatures(face({ width: 0.9 }), ASPECT).reason).toBe(FACE_REASONS.TOO_CLOSE);
    expect(extractFeatures(face({ cx: 0.05 }), ASPECT).reason).toBe(FACE_REASONS.OFF_CENTER);
    expect(extractFeatures(face({ open: 0.05 }), ASPECT).reason).toBe(FACE_REASONS.BLINK);
    expect(LIMITS.minOpenness).toBeGreaterThan(0.05);
  });

  it('rejects NaN landmarks', () => {
    const lm = face();
    lm[IDX.IRIS_A] = { x: NaN, y: 0.5 };
    expect(extractFeatures(lm, ASPECT).ok).toBe(false);
  });
});

/** Ground-truth linear-ish gaze: screen position is a function of iris offset + noise. */
function simulate(noise = 0, seed = 1) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 2; };
  return TARGETS.map(([tx, ty]) => ({
    t: [tx, ty],
    frames: Array.from({ length: 28 }, () => {
      const gx = (tx - 0.5) * 0.5 + rnd() * noise, gy = (ty - 0.5) * 0.4 + rnd() * noise;
      return extractFeatures(face({ gx, gy, yaw: rnd() * 0.01 }), ASPECT).features;
    }),
  }));
}

describe('mapper + calibration', () => {
  it('solves a linear system', () => {
    expect(solve([[2, 0], [0, 4]], [2, 8])).toEqual([1, 2]);
    expect(solve([[1, 1], [2, 2]], [1, 2])).toBeNull();     // singular
  });

  it('recovers the mapping from clean data (low cross-validated error)', () => {
    const cv = crossValidate(simulate(0), 1440, 900);
    expect(cv.meanErrFrac).toBeLessThan(0.06);      // leave-one-out extrapolates to corner targets, so > 0
    const samples = simulate(0).flatMap((tg) => tg.frames.map((f) => ({ f, t: tg.t })));
    const model = fit(samples);
    const [px, py] = predict(model, extractFeatures(face({ gx: 0.15, gy: 0.06 }), ASPECT).features);
    expect(px).toBeCloseTo(0.8, 1);
    expect(py).toBeCloseTo(0.65, 1);
  });

  it('needs enough data to fit', () => {
    expect(fit([{ f: [0, 0, 0, 0, 0.5, 0.5], t: [0.5, 0.5] }])).toBeNull();
  });

  it('accepts a good calibration and reports a real quality score', () => {
    const a = assessCalibration(simulate(0.01), 1440, 900);
    expect(a.accepted).toBe(true);
    expect(a.targetsOk).toBe(9);
    expect(a.quality).toBeGreaterThan(0.6);
    expect(a.meanErrFrac).toBeLessThanOrEqual(MAX_MEAN_ERR_FRAC);
  });

  it('rejects a noisy calibration (LOW_ACCURACY) instead of pretending', () => {
    const a = assessCalibration(simulate(0.5, 7), 1440, 900);
    expect(a.accepted).toBe(false);
    expect(a.reasons).toContain('LOW_ACCURACY');
    expect(a.quality).toBeLessThan(0.5);
  });

  it('rejects when too few targets were tracked (face lost during most targets)', () => {
    const t = simulate(0.01).map((tg, i) => (i < 5 ? { ...tg, frames: tg.frames.slice(0, MIN_FRAMES_PER_TARGET - 3) } : tg));
    const a = assessCalibration(t, 1440, 900);
    expect(a.accepted).toBe(false);
    expect(a.reasons).toContain('INSUFFICIENT_TRACKED_TARGETS');
  });

  it('tolerates occasional bad frames (outliers are removed, not fatal)', () => {
    const t = simulate(0.01);
    t.forEach((tg) => { for (let i = 0; i < 4; i++) tg.frames[i] = [5, -5, 1, 1, 0.5, 0.5]; });   // impossible spikes
    const a = assessCalibration(t, 1440, 900);
    expect(a.accepted).toBe(true);
    expect(a.validFrames).toBeLessThan(9 * 28);
  });
});

describe('filters', () => {
  it('does not discard frames of a near-constant dimension (MAD floor)', () => {
    const frames = Array.from({ length: 30 }, (_, i) => [0.1 + i * 1e-7, 0.2]);
    expect(rejectOutliers(frames)).toHaveLength(30);
  });

  it('removes spikes but keeps consistent frames', () => {
    const frames = [...Array.from({ length: 20 }, () => [0.1, 0.1]), [9, 9]];
    expect(rejectOutliers(frames)).toHaveLength(20);
  });

  it('smoother rejects impossible jumps and damps single-frame spikes', () => {
    const s = new GazeSmoother({ alpha: 0.5, maxJump: 0.4 });
    s.push([0.5, 0.5]); s.push([0.51, 0.5]);
    expect(s.push([0.99, 0.99], 16 / 9)).toBeNull();
    expect(s.rejected).toBe(1);
    const out = s.push([0.52, 0.5]);
    expect(out[0]).toBeGreaterThan(0.49);
    expect(out[0]).toBeLessThan(0.56);
  });
});
