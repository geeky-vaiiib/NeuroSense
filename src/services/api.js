import axios from 'axios';
export const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8000';
const CSRF_HEADERS = { 'X-Requested-With': 'NeuroSense' };

/** Fired when the backend says the session is gone; AuthContext listens and logs out. */
export const SESSION_EXPIRED_EVENT = 'ns:session-expired';
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me'];

function notifySessionExpired(path) {
  if (!AUTH_PATHS.some((p) => path.startsWith(p))) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

// Session = HttpOnly cookie set by the backend; JavaScript never sees or stores the token.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...CSRF_HEADERS,
  },
});

/** fetch() with the same credentials/CSRF/401 handling as the axios client. */
export async function authFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...CSRF_HEADERS,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) notifySessionExpired(path);
  return res;
}

/**
 * Every API failure surfaces as an ApiError; nothing is ever converted into success-looking data.
 * kind: unauthenticated(401) | forbidden(403) | not_found(404) | validation(422) | conflict(409)
 *       | rate_limited(429) | server(5xx) | network | timeout | invalid_response | http(other)
 */
export class ApiError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

const FALLBACK_MESSAGES = {
  unauthenticated: 'Your session has expired or you are not signed in. Please sign in again.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'The requested item was not found.',
  validation: 'The submitted data was not valid.',
  conflict: 'That conflicts with existing data.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  server: 'The NeuroSense server hit an error. Please try again later.',
  network: 'Unable to connect to the NeuroSense server. Check that the backend is running.',
  timeout: 'The request timed out. Please try again.',
  invalid_response: 'The server returned an unexpected response.',
  http: 'The request failed.',
};

const KIND_BY_STATUS = { 401: 'unauthenticated', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 422: 'validation', 429: 'rate_limited' };

function detailText(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join('; ');
  return '';
}

/** Build an ApiError from an HTTP status + parsed body (server-provided detail wins when safe to show). */
export function apiErrorFromStatus(status, body) {
  const kind = KIND_BY_STATUS[status] || (status >= 500 ? 'server' : 'http');
  const detail = detailText(body?.detail);
  // Show server text for client errors (validation/conflict/login failures); generic text for 5xx.
  const message = kind !== 'server' && detail ? detail : FALLBACK_MESSAGES[kind];
  return new ApiError(kind, message, status);
}

export function networkError(err) {
  return err?.name === 'AbortError' || err?.code === 'ECONNABORTED'
    ? new ApiError('timeout', FALLBACK_MESSAGES.timeout)
    : new ApiError('network', FALLBACK_MESSAGES.network);
}

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) notifySessionExpired(error.config?.url || '');
      return Promise.reject(apiErrorFromStatus(status, data));
    }
    return Promise.reject(networkError(error));
  }
);

export const authApi = {
  register: ({ name, email, password }) => api.post('/auth/register', { name, email, password }),
  login: ({ email, password }) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const casesApi = {
  list: (params = {}) => api.get('/cases/', { params }),
  get: (id) => api.get(`/cases/${encodeURIComponent(id)}`),
  dashboard: (params = {}) => api.get('/cases/dashboard/summary', { params }),
};

const GAZE_POLL_MS = 1500;
const GAZE_MAX_WAIT_MS = 10 * 60_000;
const stoppedWaiting = () => new ApiError('cancelled', 'You stopped waiting. Accepted server computation may continue.');
export function gazeDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(stoppedWaiting()); return; }
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(stoppedWaiting()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export const gazeApi = {
  /** Gaze Lab (dev): saved webcam sessions + validation state; run the domain check; clear sessions. */
  labSessions: () => api.get('/gaze/lab/sessions'),
  labValidate: () => api.post('/gaze/lab/validate', {}, { timeout: 120000 }),
  labClear: () => api.delete('/gaze/lab/sessions'),

  /** GET /gaze/status: is the gaze model loaded, and is OpenFace installed on the server? */
  status: (signal, population) => api.get(population === 'toddler' ? '/gaze/status?population=toddler' : '/gaze/status', { signal }),

  /**
   * Upload the recording (multipart) and poll the background job.  The probability is computed
   * by the backend only.  onStage(stage) receives the server's real processing stage.
   * Rejects with ApiError; never returns synthetic data.
   */
  async analyze({ blob, durationMs, sessionId, onStage, keepFeatures = false, signal, jobId, onAccepted, population = 'adult' }) {
    if (signal?.aborted) throw stoppedWaiting();
    if (!jobId) {
      const form = new FormData();
      form.append('population', population);
      form.append('video', blob, blob.type.includes('mp4') ? 'gaze.mp4' : 'gaze.webm');
      form.append('duration_ms', String(Math.round(durationMs)));
      if (sessionId) form.append('session_id', sessionId);
      if (keepFeatures) form.append('keep_features', 'true');
      onStage?.('uploading');
      let res;
      const uploadController = new AbortController();
      const stop = () => uploadController.abort();
      signal?.addEventListener('abort', stop, { once: true });
      const timeout = setTimeout(stop, 120_000);
      try {
        res = await fetch(`${API_BASE_URL}/gaze/analyze`, {
          method: 'POST', body: form, credentials: 'include', signal: uploadController.signal,
          headers: { ...CSRF_HEADERS, Accept: 'application/json' },
        });
        if (res.status === 401) notifySessionExpired('/gaze/analyze');
        if (!res.ok) throw apiErrorFromStatus(res.status, await res.json().catch(() => ({})));
        const accepted = await res.json();
        jobId = accepted.job_id;
        if (!jobId) throw new ApiError('invalid_response', FALLBACK_MESSAGES.invalid_response);
        onAccepted?.(jobId);
      } catch (err) {
        if (signal?.aborted) throw stoppedWaiting();
        if (err instanceof ApiError && err.status) throw err;
        throw new ApiError(uploadController.signal.aborted ? 'timeout' : 'upload_unknown',
          'Upload acceptance is unknown. The server may have accepted this recording. Do not automatically upload it again; resume requires a received job ID, otherwise explicitly record a new attempt or skip.');
      } finally {
        clearTimeout(timeout); signal?.removeEventListener('abort', stop);
      }
    }
    const t0 = Date.now();
    while (Date.now() - t0 < GAZE_MAX_WAIT_MS) {
      if (signal?.aborted) throw stoppedWaiting();
      let job;
      try { job = await api.get(`/gaze/jobs/${encodeURIComponent(jobId)}`, { signal }); }
      catch (err) { if (signal?.aborted) throw stoppedWaiting(); throw err; }
      if (signal?.aborted) throw stoppedWaiting();
      onStage?.(job.stage);
      if (job.state === 'done') {
        const body = job.result;
        if (body?.modality !== 'gaze' || !['success', 'insufficient_quality', 'out_of_domain', 'unavailable'].includes(body.status))
          throw new ApiError('invalid_response', FALLBACK_MESSAGES.invalid_response);
        return { ...body, job_id: jobId };
      }
      await gazeDelay(GAZE_POLL_MS, signal);
    }
    throw new ApiError('timeout', 'Gaze polling timed out. Server computation may continue. Resume the accepted job to check again.');
  },
};

export const screeningApi = {
  async submit(formData, idempotencyKey) {
    // Build multimodal payload — exclude large fields if null/empty
    const payload = {
      category: formData.category,
      demo: formData.demo,
      answers: formData.answers,
      gazeAnalysisId: formData.gazeAnalysisId || null,
      gazeSkipped: formData.gazeSkipped || false,
      gazeSkipReason: formData.gazeSkipReason || null,
      audioBase64: formData.audioBase64 || null,
      audioMimeType: formData.audioMimeType || null,
      transcriptHint: formData.transcriptHint || '',
      speechSkipped: formData.speechSkipped || false,
      facialImageBase64: formData.facialImageBase64 || null,
      facialSkipped: formData.facialSkipped || false,
    };

    // Warn if payload is very large (audio can be 500KB–1MB base64)
    const payloadStr = JSON.stringify(payload);
    if (payloadStr.length > 5_000_000) {
      console.warn(
        '[NeuroSense] Payload exceeds 5MB — audio data may be too large. ' +
          `Size: ${(payloadStr.length / 1_048_576).toFixed(1)}MB`
      );
    }

    // Use fetch with AbortController for a 30s timeout (audio processing takes longer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await authFetch('/screening/screen', {
        method: 'POST',
        body: payloadStr,
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
        signal: controller.signal,
      });
      if (!res.ok) throw apiErrorFromStatus(res.status, await res.json().catch(() => ({})));
      try {
        return await res.json();
      } catch {
        throw new ApiError('invalid_response', FALLBACK_MESSAGES.invalid_response);
      }
    } catch (err) {
      // No fallback: a failed screening must never turn into a synthetic result.
      throw err instanceof ApiError ? err : networkError(err);
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

export const explainApi = {
  get: (caseId) => api.get(`/explain/${encodeURIComponent(caseId)}`),
};

export const healthApi = {
  get: () => api.get('/'),
};

export default api;

export const researchApi = { recordedExample: () => api.get('/research/recorded-example') };
