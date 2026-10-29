import config from './qchat10.config.json';

export const QCHAT10 = config;
export const TODDLER_ITEMS = config.items;
export const AGE_MIN = config.ageMonthsMin;
export const AGE_MAX = config.ageMonthsMax;

/** Validates a months value against the instrument's range (18-24, the range of the training data). */
export function validateAgeMonths(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: false, message: 'Please enter your child’s age in months.' };
  if (!/^\d+$/.test(text)) return { valid: false, message: 'Please enter a whole number of months, for example 20.' };
  const n = Number(text);
  if (n < AGE_MIN || n > AGE_MAX) {
    return { valid: false, message: `This questionnaire is designed for children aged ${AGE_MIN} to ${AGE_MAX} months. Your child’s age (${n} months) is outside that range, so we can’t score it here.` };
  }
  return { valid: true, months: n, message: '' };
}

/**
 * Which questionnaire fits an age. Never silently converts: an age with no available questionnaire returns track:null.
 * `unit` is 'months' or 'years'.
 */
export function routeForAge(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return { track: null, message: 'Please enter an age.' };
  const months = unit === 'years' ? n * 12 : n;
  if (months >= AGE_MIN && months <= AGE_MAX) return { track: 'toddler', path: '/app/screening/toddler' };
  const years = months / 12;
  if (years >= 4 && years <= 11) return { track: 'child', path: '/app/screening/child' };
  if (months < AGE_MIN) return { track: null, message: `We don’t have a questionnaire for children under ${AGE_MIN} months yet.` };
  return { track: null, message: `We don’t have a questionnaire for this age yet. Toddler (${AGE_MIN}–${AGE_MAX} months) and child (4–11 years) screenings are available.` };
}
