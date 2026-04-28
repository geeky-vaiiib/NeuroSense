import axios from 'axios';
import {
  getMockCaseDetail,
  getMockCaseSummaries,
  getMockDashboardSummary,
  getMockExplanation,
  submitMockScreening,
} from '../data/mockData';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('neurosense_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        localStorage.removeItem('neurosense_token');
        window.location.href = '/';
      }

      const normalized = new Error(
        data?.detail || data?.message || `Request failed with status ${status}`
      );
      normalized.status = status;
      normalized.isNetworkError = false;
      return Promise.reject(normalized);
    }

    if (error.request) {
      const normalized = new Error('No response from server. Is the backend running?');
      normalized.isNetworkError = true;
      return Promise.reject(normalized);
    }

    const normalized = new Error(error.message || 'Unexpected request failure');
    normalized.isNetworkError = false;
    return Promise.reject(normalized);
  }
);

function shouldFallback(error) {
  return Boolean(error?.isNetworkError);
}

export const casesApi = {
  async list(params = {}) {
    try {
      return await api.get('/cases/', { params });
    } catch (error) {
      if (shouldFallback(error)) {
        return getMockCaseSummaries(params?.category);
      }
      throw error;
    }
  },

  async get(id) {
    try {
      return await api.get(`/cases/${id}`);
    } catch (error) {
      if (shouldFallback(error)) {
        return getMockCaseDetail(id);
      }
      throw error;
    }
  },

  async dashboard(params = {}) {
    try {
      return await api.get('/cases/dashboard/summary', { params });
    } catch (error) {
      if (shouldFallback(error)) {
        return getMockDashboardSummary(params?.category);
      }
      throw error;
    }
  },
};

export const screeningApi = {
  async submit(formData) {
    // Build multimodal payload — exclude large fields if null/empty
    const payload = {
      category: formData.category,
      demo: formData.demo,
      answers: formData.answers,
      aq10Score: formData.aq10Score,
      gazePoints: formData.gazePoints || [],
      gazeSkipped: formData.gazeSkipped || false,
      audioBase64: formData.audioBase64 || null,
      audioMimeType: formData.audioMimeType || null,
      transcriptHint: formData.transcriptHint || '',
      speechSkipped: formData.speechSkipped || false,
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
      const res = await fetch(`${api.defaults.baseURL}/screening/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(localStorage.getItem('neurosense_token')
            ? { Authorization: `Bearer ${localStorage.getItem('neurosense_token')}` }
            : {}),
        },
        body: payloadStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `API_ERROR: ${res.status}`);
      }

      return res.json();
    } catch (err) {
      clearTimeout(timeoutId);

      // Network / abort → fall back to mock
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Request timed out after 30 seconds');
        timeoutErr.isNetworkError = true;
        if (shouldFallback(timeoutErr)) {
          return submitMockScreening(formData);
        }
        throw timeoutErr;
      }

      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        // Network error (server not reachable) → mock fallback
        const netErr = new Error(err.message);
        netErr.isNetworkError = true;
        if (shouldFallback(netErr)) {
          return submitMockScreening(formData);
        }
      }

      throw err;
    }
  },
};

export const explainApi = {
  async get(caseId) {
    try {
      return await api.get(`/explain/${caseId}`);
    } catch (error) {
      if (shouldFallback(error)) {
        return getMockExplanation(caseId);
      }
      throw error;
    }
  },
};

export const healthApi = {
  get: () => api.get('/'),
};

export default api;
