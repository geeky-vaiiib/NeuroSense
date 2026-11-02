import { useCallback, useRef, useState } from 'react';
import { screeningApi } from '../services/api';

export function useScreening() {
  const attempt = useRef(null);
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(async (formData) => {
    if (busy.current) throw new Error('Submission already in progress.');
    const signature = JSON.stringify(formData);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      return await screeningApi.submit(formData, attempt.current.key);
    } catch (err) {
      const message = err?.message ?? 'Submission failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}
