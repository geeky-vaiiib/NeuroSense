/**
 * InteractiveRobotSpline.jsx — Spline 3D robot component.
 * Watermark removed via MutationObserver + interval cleanup.
 */
import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

function removeSplineWatermark(container) {
  if (!container) return;
  // Target all <a> tags that link to spline.design anywhere in the subtree
  const links = container.querySelectorAll('a[href*="spline.design"]');
  links.forEach((el) => {
    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.position = 'absolute';
    el.style.width = '0';
    el.style.height = '0';
    el.style.overflow = 'hidden';
  });
  // Also target by data attributes
  container.querySelectorAll('[data-logo]').forEach((el) => {
    el.style.display = 'none';
  });
}

export default function InteractiveRobotSpline({ scene, style }) {
  const containerRef = useRef(null);

  /* Aggressive watermark removal: poll + MutationObserver */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Poll every 500ms for the first 10 seconds
    const intervalId = setInterval(() => removeSplineWatermark(el), 500);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 10000);

    // Also watch for DOM changes
    const observer = new MutationObserver(() => removeSplineWatermark(el));
    observer.observe(el, { childList: true, subtree: true });

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  const handleLoad = useCallback(() => {
    // Run removal immediately on load
    if (containerRef.current) removeSplineWatermark(containerRef.current);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Suspense
        fallback={
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...style,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: '2px solid rgba(14,207,200,0.15)',
                borderTopColor: 'var(--clr-primary)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          </div>
        }
      >
        <Spline scene={scene} style={style} onLoad={handleLoad} />
      </Suspense>
    </div>
  );
}
