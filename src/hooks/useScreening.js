import { useCallback, useState } from 'react';
import { screeningApi } from '../services/api';

export function useScreening() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(async (formData) => {
    setLoading(true);
    setError(null);
    try {
      return await screeningApi.submit(formData);
    } catch (err) {
      const message = err?.message ?? 'Submission failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}
