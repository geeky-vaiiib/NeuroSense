/**
 * Calibration mapping: eye/head features -> normalised screen position, by ridge regression.
 *
 * design row = [1, gx, gy, yaw, pitch, cx, cy, gx^2, gy^2, gx*gy]  (standardised, bias unpenalised)
 * A second-order term in the iris position captures the mild non-linearity of eye rotation; head pose
 * terms keep the estimate usable when the head drifts a little. Ridge (lambda) keeps 10 parameters
 * stable when there are only nine distinct calibration targets.
 */

export const RIDGE_LAMBDA = 0.05;
export const DESIGN_SIZE = 10;

export function design(f) {
  const [gx, gy, yaw, pitch, cx, cy] = f;
  return [gx, gy, yaw, pitch, cx, cy, gx * gx, gy * gy, gx * gy];   // bias handled separately
}

/** Solve A x = b (A: n x n) by Gaussian elimination with partial pivoting. Returns null if singular. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * @param samples [{ f: number[6], t: [tx, ty] }]  t = target in normalised screen coordinates
 * @returns model or null when there is not enough / degenerate data
 */
export function fit(samples, lambda = RIDGE_LAMBDA) {
  if (!samples || samples.length < DESIGN_SIZE) return null;
  const X = samples.map((s) => design(s.f));
  const p = X[0].length;
  const mean = new Array(p).fill(0);
  const std = new Array(p).fill(0);
  for (const row of X) row.forEach((v, j) => { mean[j] += v / X.length; });
  for (const row of X) row.forEach((v, j) => { std[j] += (v - mean[j]) ** 2 / X.length; });
  for (let j = 0; j < p; j++) std[j] = Math.sqrt(std[j]) || 1;
  const Z = X.map((row) => [1, ...row.map((v, j) => (v - mean[j]) / std[j])]);
  const q = p + 1;
  const A = Array.from({ length: q }, () => new Array(q).fill(0));
  const bx = new Array(q).fill(0);
  const by = new Array(q).fill(0);
  Z.forEach((z, i) => {
    for (let r = 0; r < q; r++) {
      bx[r] += z[r] * samples[i].t[0];
      by[r] += z[r] * samples[i].t[1];
      for (let c = 0; c < q; c++) A[r][c] += z[r] * z[c];
    }
  });
  for (let r = 1; r < q; r++) A[r][r] += lambda * Z.length;   // bias (index 0) is not penalised
  const wx = solve(A, bx);
  const wy = solve(A, by);
  if (!wx || !wy) return null;
  return { mean, std, wx, wy, lambda };
}

/** Normalised screen position (unclipped) for one feature vector. */
export function predict(model, f) {
  const z = design(f).map((v, j) => (v - model.mean[j]) / model.std[j]);
  let x = model.wx[0];
  let y = model.wy[0];
  for (let j = 0; j < z.length; j++) {
    x += model.wx[j + 1] * z[j];
    y += model.wy[j + 1] * z[j];
  }
  return [x, y];
}

/**
 * Leave-one-target-out cross-validation: fit without a target, predict that target's frames.
 * @param byTarget  Array (one entry per target) of { t: [tx, ty], frames: number[6][] }
 * @returns {{ perTarget: (number|null)[], meanErrFrac: number|null }}  error as a fraction of the
 *          screen diagonal, so it does not depend on the display size.
 */
export function crossValidate(byTarget, screenW, screenH) {
  const diag = Math.hypot(screenW, screenH);
  const perTarget = byTarget.map((held, i) => {
    if (!held.frames.length) return null;
    const train = [];
    byTarget.forEach((tg, j) => { if (j !== i) tg.frames.forEach((f) => train.push({ f, t: tg.t })); });
    const model = fit(train);
    if (!model) return null;
    const errs = held.frames.map((f) => {
      const [px, py] = predict(model, f);
      return Math.hypot((px - held.t[0]) * screenW, (py - held.t[1]) * screenH) / diag;
    }).sort((a, b) => a - b);
    return errs[Math.floor(errs.length / 2)];                 // median error of this target's frames
  });
  const ok = perTarget.filter((e) => e !== null);
  return { perTarget, meanErrFrac: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null };
}
