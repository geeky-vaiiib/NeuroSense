/**
 * SplineScene.jsx — Lazy-loaded Spline 3D scene wrapper.
 * Adapted from shadcn/splite for NeuroSense's vanilla CSS + JSX stack.
 */
import { Suspense, lazy } from 'react';
const Spline = lazy(() => import('@splinetool/react-spline'));

/**
 * @param {object} props
 * @param {string}  props.scene     — Spline scene URL (.splinecode)
 * @param {string}  [props.className] — Optional CSS class
 * @param {object}  [props.style]   — Optional inline styles
 */
export function SplineScene({ scene, className, style }) {
  return (
    <Suspense
      fallback={
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 32,
            height: 32,
            border: '2.5px solid var(--clr-primary-dim)',
            borderTopColor: 'var(--clr-primary)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        </div>
      }
    >
      <Spline
        scene={scene}
        className={className}
        style={style}
      />
    </Suspense>
  );
}
