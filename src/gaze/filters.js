/** Small, dependency-free filters for gaze coordinates and calibration frames. */

export const median = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Drop frames whose feature vector is a statistical outlier (any dimension beyond `k` robust
 * z-scores, MAD-scaled). Used per calibration target so a saccade or head jerk does not skew the fit.
 */
export const MAD_FLOOR = 0.01;   // feature units; stops near-constant dimensions from flagging every frame

export function rejectOutliers(frames, k = 3.5) {
  if (frames.length < 5) return frames;
  const dims = frames[0].length;
  const med = [];
  const mad = [];
  for (let d = 0; d < dims; d++) {
    const col = frames.map((f) => f[d]);
    const m = median(col);
    med.push(m);
    mad.push(Math.max(median(col.map((v) => Math.abs(v - m))) * 1.4826, MAD_FLOOR));
  }
  return frames.filter((f) => f.every((v, d) => Math.abs(v - med[d]) / mad[d] <= k));
}

/**
 * Task-time smoother: median-of-3 (kills single-frame spikes) followed by an exponential moving
 * average (alpha 0.5 keeps ~1 frame of lag at 30 fps, so fixations/saccades stay distinguishable).
 * A jump larger than `maxJump` (fraction of the diagonal) between consecutive frames is rejected.
 */
export class GazeSmoother {
  constructor({ alpha = 0.5, maxJump = 0.5 } = {}) {
    this.alpha = alpha;
    this.maxJump = maxJump;
    this.reset();
  }

  reset() {
    this.win = [];
    this.last = null;
    this.rejected = 0;
  }

  /** @param p [x, y] normalised; @param aspect W/H (to make the jump test isotropic) */
  push(p, aspect = 1) {
    if (this.last) {
      const dx = (p[0] - this.last[0]) * aspect;
      const dy = p[1] - this.last[1];
      const diag = Math.hypot(aspect, 1);
      if (Math.hypot(dx, dy) / diag > this.maxJump) { this.rejected += 1; return null; }
    }
    this.win.push(p);
    if (this.win.length > 3) this.win.shift();
    const m = [median(this.win.map((v) => v[0])), median(this.win.map((v) => v[1]))];
    const out = this.last
      ? [this.alpha * m[0] + (1 - this.alpha) * this.last[0], this.alpha * m[1] + (1 - this.alpha) * this.last[1]]
      : m;
    this.last = out;
    return out;
  }
}
