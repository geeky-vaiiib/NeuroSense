/**
 * ErrorBoundary.jsx — Global React error boundary for NeuroSense.
 * Catches unhandled render errors and shows a branded recovery screen.
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[NeuroSense ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '40px',
          background: 'var(--color-bg)',
          textAlign: 'center',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-risk-high)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-neutral-900)', marginBottom: '8px' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)', maxWidth: '420px', lineHeight: 'var(--leading-relaxed)' }}>
              An unexpected error occurred. This has been logged. Please reload the page to continue.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-primary)',
              color: 'white',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-neutral-500)',
              background: 'var(--color-neutral-100)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              maxWidth: '600px',
              overflow: 'auto',
              maxHeight: '200px',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
