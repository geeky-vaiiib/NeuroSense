/**
 * Calibration protocol, quality score and acceptance rule (all constants documented here).
 *
 * Protocol: 9 targets over the whole viewport. Per target: wait until the face has been stable for
 * STABLE_FRAMES, show the dot, ignore the first SETTLE_MS (the eye is still travelling), then collect
 * frames for at least COLLECT_MS and until TARGET_FRAMES arrived (at most COLLECT_MAX_MS, so a
 * slow device is not penalised for its frame rate). Frames with no face / blink / bad geometry are discarded and, if the face is
 * lost, the target is HELD (the timer restarts) instead of failing the session.
 *
 * Quality (0-1) = 0.75 * accuracy + 0.25 * validity
 *   accuracy = 1 - meanErr / ACCURACY_ZERO,   meanErr = mean over targets of the leave-one-target-out
 *              median error as a fraction of the screen diagonal (honest: never scored on training data)
 *   validity = valid frames / frames expected at ~EXPECTED_FPS
 * Accepted when >= MIN_TARGETS_OK targets produced >= MIN_FRAMES_PER_TARGET clean frames AND
 * meanErr <= MAX_MEAN_ERR_FRAC.
 *
 * Why 12 % of the diagonal (~200 px on a 1440x900 laptop): the visual task shows large, separated
 * pictures and the model consumes coarse x/y + fixation flags, so region-level accuracy is what matters.
 * Webcam iris tracking is not clinical-grade; this is a technical usability floor, not a clinical claim.
 */
import { crossValidate } from './mapper';
import { rejectOutliers } from './filters';

export const AXIS = [0.1, 0.5, 0.9];
export const TARGETS = AXIS.flatMap((fy) => AXIS.map((fx) => [fx, fy]));   // row-major, 9 points

export const STABLE_FRAMES = 8;
export const SETTLE_MS = 700;
export const COLLECT_MS = 1400;          // minimum collection time per target
export const COLLECT_MAX_MS = 5000;      // upper bound: slow devices keep collecting until enough frames arrive
export const TARGET_FRAMES = 20;         // frames after which collection may end (once COLLECT_MS has passed)
export const EXPECTED_FPS = 20;
export const MIN_FRAMES_PER_TARGET = 10;
export const MIN_TARGETS_OK = 8;
export const MAX_MEAN_ERR_FRAC = 0.12;
export const ACCURACY_ZERO = 0.2;
export const MAX_ATTEMPTS = 3;               // "skip" is only offered after this many failed attempts

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * @param targets [{ t:[tx,ty], frames:number[6][] }] raw collected frames per target
 * @returns assessment (also reports why it failed, machine-readable)
 */
export function assessCalibration(targets, screenW, screenH) {
  const cleaned = targets.map((tg) => ({ t: tg.t, frames: rejectOutliers(tg.frames) }));
  const totalRaw = targets.reduce((n, tg) => n + tg.frames.length, 0);
  const totalClean = cleaned.reduce((n, tg) => n + tg.frames.length, 0);
  const expected = (COLLECT_MS / 1000) * EXPECTED_FPS * targets.length;
  const targetsOk = cleaned.filter((tg) => tg.frames.length >= MIN_FRAMES_PER_TARGET).length;
  const usable = cleaned.filter((tg) => tg.frames.length >= MIN_FRAMES_PER_TARGET);
  const cv = usable.length >= 4 ? crossValidate(usable, screenW, screenH) : { perTarget: [], meanErrFrac: null };

  const validity = clamp01(totalClean / expected);
  const accuracy = cv.meanErrFrac === null ? 0 : clamp01(1 - cv.meanErrFrac / ACCURACY_ZERO);
  const quality = cv.meanErrFrac === null ? 0 : 0.75 * accuracy + 0.25 * validity;

  const reasons = [];
  if (targetsOk < MIN_TARGETS_OK) reasons.push('INSUFFICIENT_TRACKED_TARGETS');
  if (cv.meanErrFrac === null) reasons.push('NO_FIT');
  else if (cv.meanErrFrac > MAX_MEAN_ERR_FRAC) reasons.push('LOW_ACCURACY');

  return {
    accepted: reasons.length === 0,
    reasons,
    quality: Math.round(quality * 1000) / 1000,
    meanErrFrac: cv.meanErrFrac,
    meanErrPx: cv.meanErrFrac === null ? null : Math.round(cv.meanErrFrac * Math.hypot(screenW, screenH)),
    targetsOk,
    targetsTotal: targets.length,
    validFrames: totalClean,
    rawFrames: totalRaw,
    perTargetErrFrac: cv.perTarget,
    cleaned,
  };
}
