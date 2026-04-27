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
  async submit(payload) {
    try {
      return await api.post('/screening/screen', payload);
    } catch (error) {
      if (shouldFallback(error)) {
        return submitMockScreening(payload);
      }
      throw error;
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
