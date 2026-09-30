/**
 * MediaPipe FaceMesh (0.4.x, refineLandmarks: true) landmark geometry -> gaze features.
 *
 * Index reference (canonical FaceMesh topology, 478 points when iris refinement is on):
 *   eye corners  : left 33 (outer) / 133 (inner), right 362 (inner) / 263 (outer)
 *   eyelids      : left 159 (top) / 145 (bottom), right 386 (top) / 374 (bottom)
 *   iris centres : 468 (first iris), 473 (second iris)
 *   head         : nose tip 1, cheeks 234 / 454
 *
 * All geometry is computed in aspect-corrected image space (x * width/height, y) so distances are
 * isotropic. Nothing here is a pupil-diameter measurement: only iris *position* is derived.
 */

export const IDX = {
  L_OUTER: 33, L_INNER: 133, L_TOP: 159, L_BOTTOM: 145,
  R_INNER: 362, R_OUTER: 263, R_TOP: 386, R_BOTTOM: 374,
  IRIS_A: 468, IRIS_B: 473,
  NOSE: 1, L_CHEEK: 234, R_CHEEK: 454,
};
export const MIN_LANDMARKS = 478;

/** Order of the mapping-model inputs. Every consumer imports this; it is never re-typed elsewhere. */
export const FEATURE_NAMES = ['gx', 'gy', 'yaw', 'pitch', 'cx', 'cy'];

export const LIMITS = {
  minOpenness: 0.14,       // eyelid height / eye width below this = blink (frame ignored)
  minFaceWidth: 0.16,      // cheek-to-cheek as a fraction of frame width
  maxFaceWidth: 0.85,
  centerMin: 0.12,         // face centre must stay inside [min, max] of the frame
  centerMax: 0.88,
};

export const FACE_REASONS = {
  NO_LANDMARKS: 'FACE_NOT_DETECTED',
  INCOMPLETE: 'LANDMARKS_INCOMPLETE',
  BLINK: 'BLINK',
  TOO_FAR: 'FACE_TOO_FAR',
  TOO_CLOSE: 'FACE_TOO_CLOSE',
  OFF_CENTER: 'FACE_OFF_CENTER',
};

const pt = (lm, i, aspect) => ({ x: lm[i].x * aspect, y: lm[i].y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);

function eyeGaze(lm, outerI, innerI, topI, botI, irisI, aspect) {
  let a = pt(lm, outerI, aspect);
  let b = pt(lm, innerI, aspect);
  if (a.x > b.x) [a, b] = [b, a];                  // a = image-left corner, b = image-right corner
  const axis = sub(b, a);
  const w = len(axis);
  if (!(w > 1e-6)) return null;
  const u = { x: axis.x / w, y: axis.y / w };
  const n = { x: -u.y, y: u.x };                    // perpendicular, y grows downward
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const d = sub(pt(lm, irisI, aspect), mid);
  const openness = len(sub(pt(lm, topI, aspect), pt(lm, botI, aspect))) / w;
  return { gx: dot(d, u) / w, gy: dot(d, n) / w, openness, center: mid, width: w };
}

/**
 * @param lm      array of {x, y, z} normalised landmarks (or null/undefined when no face)
 * @param aspect  video width / height
 * @returns {{ok:boolean, reason?:string, features?:number[], openness?:number, faceWidth?:number, center?:{x:number,y:number}}}
 */
export function extractFeatures(lm, aspect = 16 / 9) {
  if (!lm || !lm.length) return { ok: false, reason: FACE_REASONS.NO_LANDMARKS };
  if (lm.length < MIN_LANDMARKS) return { ok: false, reason: FACE_REASONS.INCOMPLETE };
  for (const i of Object.values(IDX)) {
    const p = lm[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return { ok: false, reason: FACE_REASONS.INCOMPLETE };
  }
  const L = eyeGaze(lm, IDX.L_OUTER, IDX.L_INNER, IDX.L_TOP, IDX.L_BOTTOM, IDX.IRIS_A, aspect);
  const R = eyeGaze(lm, IDX.R_OUTER, IDX.R_INNER, IDX.R_TOP, IDX.R_BOTTOM, IDX.IRIS_B, aspect);
  if (!L || !R) return { ok: false, reason: FACE_REASONS.INCOMPLETE };

  const cheekL = lm[IDX.L_CHEEK];
  const cheekR = lm[IDX.R_CHEEK];
  const faceWidth = Math.abs(cheekL.x - cheekR.x);                // fraction of frame width
  const cx = (cheekL.x + cheekR.x) / 2;
  const cy = (cheekL.y + cheekR.y) / 2;
  const base = { faceWidth, center: { x: cx, y: cy } };

  if (faceWidth < LIMITS.minFaceWidth) return { ok: false, reason: FACE_REASONS.TOO_FAR, ...base };
  if (faceWidth > LIMITS.maxFaceWidth) return { ok: false, reason: FACE_REASONS.TOO_CLOSE, ...base };
  if (cx < LIMITS.centerMin || cx > LIMITS.centerMax || cy < LIMITS.centerMin || cy > LIMITS.centerMax) {
    return { ok: false, reason: FACE_REASONS.OFF_CENTER, ...base };
  }
  const openness = (L.openness + R.openness) / 2;
  if (openness < LIMITS.minOpenness) return { ok: false, reason: FACE_REASONS.BLINK, openness, ...base };

  const faceW = faceWidth * aspect;                                // aspect-corrected width
  const eyeMidY = (L.center.y + R.center.y) / 2;
  const nose = pt(lm, IDX.NOSE, aspect);
  const yaw = (nose.x - (cx * aspect)) / faceW;                    // head turn proxy
  const pitch = (nose.y - eyeMidY) / faceW;                        // head tilt proxy

  return {
    ok: true,
    features: [(L.gx + R.gx) / 2, (L.gy + R.gy) / 2, yaw, pitch, cx, cy],
    openness,
    ...base,
  };
}

/** Indices worth drawing in the (optional) landmark overlay. */
export const OVERLAY_INDICES = [
  IDX.L_OUTER, IDX.L_INNER, IDX.L_TOP, IDX.L_BOTTOM, IDX.R_INNER, IDX.R_OUTER, IDX.R_TOP, IDX.R_BOTTOM,
  IDX.IRIS_A, IDX.IRIS_B, IDX.NOSE, IDX.L_CHEEK, IDX.R_CHEEK,
];
