import { useCallback, useRef, useState } from 'react';
import { explainApi } from '../services/api';

export function useShap() {
  const [explanations, setExplanations] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const cache = useRef({});

  const fetchExplanation = useCallback(async (caseId) => {
    if (cache.current[caseId]) {
      setExplanations((prev) => ({ ...prev, [caseId]: cache.current[caseId] }));
      return cache.current[caseId];
    }

    setLoading((prev) => ({ ...prev, [caseId]: true }));
    setErrors((prev) => ({ ...prev, [caseId]: null }));

    try {
      const data = await explainApi.get(caseId);
      cache.current[caseId] = data;
      setExplanations((prev) => ({ ...prev, [caseId]: data }));
      return data;
    } catch (error) {
      setErrors((prev) => ({ ...prev, [caseId]: error.message }));
      throw error;
    } finally {
      setLoading((prev) => ({ ...prev, [caseId]: false }));
    }
  }, []);

  const requestExplanation = useCallback(async (caseId) => {
    delete cache.current[caseId];
    return fetchExplanation(caseId);
  }, [fetchExplanation]);

  const getSortedFeatures = useCallback((caseId) => {
    const explanation = explanations[caseId];
    if (!explanation?.shap) return [];
    return [...explanation.shap].sort(
      (left, right) => Math.abs(right.shapValue) - Math.abs(left.shapValue)
    );
  }, [explanations]);

  const getTopFeatures = useCallback((caseId, n = 5) => {
    return getSortedFeatures(caseId).slice(0, n);
  }, [getSortedFeatures]);

  const clearCache = useCallback((caseId) => {
    if (caseId) {
      delete cache.current[caseId];
      setExplanations((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      return;
    }

    cache.current = {};
    setExplanations({});
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
