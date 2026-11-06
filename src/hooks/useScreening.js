import { useDraftOwner } from '../context/AuthContext';
import { getAttempt, saveAttempt, clearAttempt } from '../utils/flowDrafts';
import { useCallback, useRef, useState } from 'react';
import { screeningApi } from '../services/api';

export function useScreening() {
  const owner = useDraftOwner();
  const attempt = useRef(getAttempt(owner));
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(async (formData) => {
    if (busy.current) throw new Error('Submission already in progress.');
    const signature = JSON.stringify(formData);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    saveAttempt(owner, attempt.current);
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await screeningApi.submit(formData, attempt.current.key);
      clearAttempt(owner);
      return result;
    } catch (err) {
      const message = err?.message ?? 'Submission failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [owner]);

  return { submit, loading, error };
}
