/**
 * api.js
 * Axios instance configured for the NeuroSense FastAPI backend.
 * Base URL: http://localhost:8000
 */

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/* ── Request Interceptor ─────────────────────────────────── */
api.interceptors.request.use(
  (config) => {
    // Attach auth token if present
    const token = localStorage.getItem('neurosense_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response Interceptor ────────────────────────────────── */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        localStorage.removeItem('neurosense_token');
        window.location.href = '/';
      }

      const message =
        data?.detail ||
        data?.message ||
        `Request failed with status ${status}`;

      return Promise.reject(new Error(message));
    }

    if (error.request) {
      return Promise.reject(new Error('No response from server. Is the backend running?'));
    }

    return Promise.reject(error);
  }
);

/* ── API Endpoints ───────────────────────────────────────── */
export const casesApi = {
  /** GET /cases — list all cases */
  list: (params) => api.get('/cases', { params }),

  /** GET /cases/:id — get a single case */
  get: (id) => api.get(`/cases/${id}`),

  /** POST /cases — create a new case */
  create: (payload) => api.post('/cases', payload),

  /** PATCH /cases/:id — update a case */
  update: (id, payload) => api.patch(`/cases/${id}`, payload),

  /** DELETE /cases/:id — delete a case */
  delete: (id) => api.delete(`/cases/${id}`),
};

export const screeningApi = {
  /** POST /screening/submit — submit screening responses */
  submit: (payload) => api.post('/screening/submit', payload),

  /** GET /screening/tools — list available screening tools */
  tools: () => api.get('/screening/tools'),

  /** GET /screening/:id/result — get results for a screening session */
  result: (id) => api.get(`/screening/${id}/result`),
};

export const shapApi = {
  /** POST /shap/explain — request SHAP explanation for a case */
  explain: (caseId) => api.post('/shap/explain', { case_id: caseId }),

  /** GET /shap/:caseId — fetch cached SHAP values */
  get: (caseId) => api.get(`/shap/${caseId}`),
};

export const analyticsApi = {
  /** GET /analytics/dashboard — dashboard summary stats */
  dashboard: () => api.get('/analytics/dashboard'),
};

/* ── Mock: submitScreening ───────────────────────────────── */
/**
 * Simulates submitting the completed screening wizard to the backend.
 * Returns a fake case ID after a 1.5-second delay.
 * Replace with a real POST when the FastAPI endpoint is ready.
 *
 * @param {Object} formData - { demo, answers, aq10Score }
 * @returns {Promise<{ caseId: string, status: string }>}
 */
export async function submitScreening(formData) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return {
    caseId: 'NS-0042',
    status: 'processing',
  };
}

export default api;
