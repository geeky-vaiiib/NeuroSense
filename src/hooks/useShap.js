/**
 * useShap.js
 * Custom hook for fetching, caching, and managing SHAP explanation data.
 */

import { useState, useCallback, useRef } from 'react';
import { shapApi } from '../services/api';
import { MOCK_CASES } from '../data/mockData';

export function useShap() {
  const [explanations, setExplanations] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const cache = useRef({});

  /**
   * Fetch SHAP values for a given case ID.
   * Falls back to mock data when the backend is unavailable.
   */
  const fetchExplanation = useCallback(async (caseId) => {
    // Return cached result immediately
    if (cache.current[caseId]) {
      setExplanations((prev) => ({ ...prev, [caseId]: cache.current[caseId] }));
      return cache.current[caseId];
    }

    setLoading((prev) => ({ ...prev, [caseId]: true }));
    setErrors((prev) => ({ ...prev, [caseId]: null }));

    try {
      let data;
      try {
        data = await shapApi.get(caseId);
      } catch {
        // Fallback to embedded mock SHAP data
        const mockCase = MOCK_CASES.find((c) => c.id === caseId);
        if (!mockCase) throw new Error(`No mock data for case ${caseId}`);
        data = { ...mockCase.shapValues, caseId, mock: true };
      }

      cache.current[caseId] = data;
      setExplanations((prev) => ({ ...prev, [caseId]: data }));
      return data;
    } catch (err) {
      setErrors((prev) => ({ ...prev, [caseId]: err.message }));
      throw err;
    } finally {
      setLoading((prev) => ({ ...prev, [caseId]: false }));
    }
  }, []);

  /**
   * Request a fresh SHAP explanation from the backend model.
   */
  const requestExplanation = useCallback(async (caseId) => {
    setLoading((prev) => ({ ...prev, [caseId]: true }));
    setErrors((prev) => ({ ...prev, [caseId]: null }));

    try {
      let data;
      try {
        data = await shapApi.explain(caseId);
      } catch {
        const mockCase = MOCK_CASES.find((c) => c.id === caseId);
        if (!mockCase) throw new Error(`No mock data for case ${caseId}`);
        data = { ...mockCase.shapValues, caseId, mock: true };
      }

      delete cache.current[caseId]; // invalidate cache
      cache.current[caseId] = data;
      setExplanations((prev) => ({ ...prev, [caseId]: data }));
      return data;
    } catch (err) {
      setErrors((prev) => ({ ...prev, [caseId]: err.message }));
      throw err;
    } finally {
      setLoading((prev) => ({ ...prev, [caseId]: false }));
    }
  }, []);

  /**
   * Get sorted features by absolute SHAP magnitude.
   */
  const getSortedFeatures = useCallback((caseId) => {
    const explanation = explanations[caseId];
    if (!explanation?.features) return [];
    return [...explanation.features].sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value)
    );
  }, [explanations]);

  /**
   * Get the top-N most influential features.
   */
  const getTopFeatures = useCallback((caseId, n = 5) => {
    return getSortedFeatures(caseId).slice(0, n);
  }, [getSortedFeatures]);

  const clearCache = useCallback((caseId) => {
    if (caseId) {
      delete cache.current[caseId];
      setExplanations((prev) => { const next = { ...prev }; delete next[caseId]; return next; });
    } else {
      cache.current = {};
      setExplanations({});
    }
  }, []);

  return {
    explanations,
    loading,
    errors,
    fetchExplanation,
    requestExplanation,
    getSortedFeatures,
    getTopFeatures,
    clearCache,
  };
}
