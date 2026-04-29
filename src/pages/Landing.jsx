/**
 * Landing.jsx — Full-viewport hero-only landing page.
 * Dark card with custom 3D brain visualization + spotlight.
 */
import React, { useState, useEffect, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Navbar from '../components/Navbar';
import { Spotlight } from '../components/ui/Spotlight';

const InteractiveRobotSpline = lazy(() => import('../components/InteractiveRobotSpline'));

const ROBOT_SCENE_URL = 'https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode';

/* Re-export NeuroLogo for backward compat */
export { default as NeuroLogo } from '../components/NeuroLogo';

/* ── Main Landing ────────────────────────────────────────── */
export default function Landing() {
  const { isDark } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      background: isDark
        ? 'radial-gradient(ellipse at 50% 40%, #0a0e2a 0%, #060a1a 40%, #020308 100%)'
        : 'radial-gradient(ellipse at 30% 40%, var(--clr-bg) 0%, var(--clr-surface) 50%, var(--clr-surface-2) 100%)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* ── Navbar ──────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero — Full viewport ───────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        padding: '0 48px',
        position: 'relative',
        zIndex: 2,
      }}>
        
        {/* Absolute Background 3D Scene — Spline Robot */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}>
          <React.Suspense fallback={
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 28, height: 28,
                border: '2px solid rgba(14,207,200,0.15)',
                borderTopColor: 'var(--clr-primary)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          }>
            <InteractiveRobotSpline
              scene={ROBOT_SCENE_URL}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
              }}
            />
          </React.Suspense>
          {/* Gradient overlay for text readability */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: isDark 
              ? 'linear-gradient(to right, rgba(2,5,5,0.92) 0%, rgba(2,5,5,0.35) 45%, transparent 100%)'
              : 'linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 45%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          {/* Cover for Spline watermark (bottom-right) */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 240,
            height: 56,
            background: isDark
              ? 'linear-gradient(to left, rgba(2,3,8,1) 60%, transparent 100%)'
              : 'linear-gradient(to left, rgba(255,255,255,1) 60%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 5,
          }} />
        </div>

        <div style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
        }}>

          {/* LEFT — Text content */}
          <div style={{
            flex: '0 0 50%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '24px',
            position: 'relative',
            zIndex: 10,
          }}>
            {/* Badge */}
            <div style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(12px)',
              transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s',
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '9999px',
                  background: isDark ? 'rgba(14,207,200,0.08)' : 'rgba(14,207,200,0.06)',
                  border: isDark ? '1px solid rgba(14,207,200,0.15)' : '1px solid rgba(14,207,200,0.12)',
                width: 'fit-content',
                backdropFilter: 'blur(8px)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isDark ? 'var(--clr-primary)' : 'var(--clr-primary)', display: 'inline-block',
                  animation: 'ns-pulse 2s ease-in-out infinite',
                }} />
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: isDark ? 'var(--clr-primary)' : 'var(--clr-primary-hover)', letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Neurodevelopmental Screening
                </span>
              </div>
            </div>

            {/* Title */}
            <div style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s',
            }}>
              <h1 style={{
                fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
                margin: 0,
                fontFamily: 'var(--font-display)',
                color: isDark ? 'var(--clr-text-primary)' : 'var(--clr-text-primary)',
              }}>
                Understand{' '}
                <span style={{
                  background: 'var(--grad-cta)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  your mind
                </span>
                <br />
                with clarity.
              </h1>
            </div>

            {/* Description */}
            <div style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s',
            }}>
              <p style={{
                fontSize: '1.05rem',
                color: isDark ? 'var(--clr-text-secondary)' : 'var(--clr-text-secondary)',
                lineHeight: 1.7,
                maxWidth: '460px',
                margin: 0,
              }}>
                NeuroSense combines validated ASD assessment tools with explainable AI — screening adults, children, and toddlers with transparent, clinician-grade reports.
              </p>
            </div>

            {/* CTAs */}
            <div style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s',
              display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px',
            }}>
              <Link to="/app/screening" id="hero-cta-primary" style={{
                padding: '15px 30px', borderRadius: '12px', border: 'none',
                background: 'var(--clr-primary)',
                color: 'var(--clr-text-inverse)', fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                boxShadow: '0 4px 20px rgba(14,207,200,0.3)',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                letterSpacing: '0.01em',
              }}>
                Start screening
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <Link to="/auth" style={{
                padding: '15px 26px', borderRadius: '12px',
                border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)'}`,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)',
                backdropFilter: 'blur(10px)',
                color: isDark ? 'var(--clr-text-primary)' : 'var(--clr-text-primary)',
                fontSize: '1rem', fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
                transition: 'all 0.2s',
              }}>Sign in</Link>
            </div>

            {/* Trust signals */}
            <div style={{
              opacity: mounted ? 1 : 0,
              transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1) 0.65s',
              display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '12px',
            }}>
              {['AI-explained results', 'DPDP compliant', '3 screening tracks'].map(t => (
                <span key={t} style={{
                  fontSize: '0.82rem', color: isDark ? 'var(--clr-text-muted)' : 'var(--clr-text-muted)',
                  display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500,
                  letterSpacing: '0.01em',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
          
          {/* Right side is intentionally empty to let the 3D scene shine through */}
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 20,
        padding: '16px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      }}>
        <span style={{
          fontSize: '0.72rem',
          color: isDark ? 'rgba(255,255,255,0.25)' : 'var(--color-neutral-400)',
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--clr-primary)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          DPDP Act 2023 Compliant
        </span>
        <div style={{ display: 'flex', gap: '20px' }}>
          {['Privacy', 'Terms', 'Accessibility'].map(l => (
            <a key={l} href="#" style={{
              fontSize: '0.72rem',
              color: isDark ? 'rgba(255,255,255,0.2)' : 'var(--color-neutral-400)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}>{l}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
