import { healthApi } from '../services/api';
/** Must finish before requesting media. Measurements remain useful without a classifier. */
export async function recordingCapability(task, category) {
  const health = await healthApi.get();
  if (health.status !== 'ok') throw new Error('Backend unavailable. Retry the connection or explicitly skip this recording.');
  const key = task === 'facial' ? 'facial_expression' : 'speech_emotion';
  const available = category === 'adult' && health.modalities?.[key]?.status === 'available_experimental';
  return available ? `${key.replace('_', ' ')} is available for adult technical research; excluded from screening.`
    : 'Measurements only for this recording; the optional research classifier is unavailable or outside the supported age scope.';
}
