import { useEffect, useState } from 'react';
import { healthApi } from '../services/api';

/**
 * useBackendStatus — polls the backend health endpoint at a regular interval
 * and exposes connection status.
 *
 * @param {number} intervalMs  polling interval in milliseconds (default 30 000)
 * @returns {{ isOnline: boolean, isChecking: boolean, lastChecked: Date | null }}
 */
export function useBackendStatus(intervalMs = 30000) {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    let active = true;

    async function check() {
      if (!active) return;
      setIsChecking(true);
      try {
        const data = await healthApi.get();
        if (active) {
          setIsOnline(data?.status === 'ok');
        }
      } catch {
        if (active) {
          setIsOnline(false);
        }
      } finally {
        if (active) {
          setIsChecking(false);
          setLastChecked(new Date());
        }
      }
    }

    // Initial check on mount
    check();

    // Recurring poll
    const id = setInterval(check, intervalMs);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { isOnline, isChecking, lastChecked };
}
