/**
 * useScreening.js
 * Custom hook for the screening wizard's submit flow.
 *
 * Exposes:
 *   submit(formData)  — calls the mock API, returns { caseId, status }
 *   loading            — true while the API call is in-flight
 *   error              — error message string, or null
 *
 * Usage:
 *   const { submit, loading, error } = useScreening();
 *   const result = await submit({ demo, answers, aq10Score });
 *   // result.caseId === 'NS-0042'
 */

import { useState, useCallback } from 'react';
import { submitScreening } from '../services/api';

export function useScreening() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const submit = useCallback(async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await submitScreening(formData);
      return result;
    } catch (err) {
      const msg = err?.message ?? 'Submission failed. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}
