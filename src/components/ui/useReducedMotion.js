import { useEffect, useState } from 'react';

/** True when the OS asks for reduced motion (also honours the in-app Settings toggle class). */
export default function useReducedMotion() {
  const read = () =>
    (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) ||
    (typeof document !== 'undefined' && document.body.classList.contains('reduce-motion'));
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(read());
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}
