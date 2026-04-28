/**
 * App.jsx — Root with AuthProvider, protected routes, landing + auth pages.
 */
import { Component, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';

import Landing   from './pages/Landing';
import Auth      from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Screening from './pages/Screening';
import Results   from './pages/Results';
import Cases     from './pages/Cases';
import Settings  from './pages/Settings';
import Diagnostic from './pages/Diagnostic';

/* ── Error Boundary ──────────────────────────────────────── */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[NeuroSense] Unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '32px',
            textAlign: 'center',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              padding: '32px',
              borderRadius: '22px',
              border: '1px solid var(--color-neutral-200)',
              backgroundColor: 'var(--color-bg-card)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            <div
              style={{
                fontSize: '2.5rem',
                marginBottom: '12px',
              }}
            >
              ⚠️
            </div>
            <h2
              style={{
                margin: '0 0 8px',
                color: 'var(--color-neutral-900)',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: 'var(--color-neutral-600)',
                lineHeight: 1.7,
                marginBottom: '20px',
              }}
            >
              An unexpected error occurred. You can try reloading the page.
            </p>
            <pre
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-neutral-200)',
                color: 'var(--color-risk-high)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflow: 'auto',
                marginBottom: '20px',
              }}
            >
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minHeight: '44px',
                padding: '0 24px',
                borderRadius: '12px',
                border: 'none',
                background:
                  'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(26,26,24,0.10)',
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ── 404 ─────────────────────────────────────────────────── */
function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: '12px', textAlign: 'center',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 700, color: 'var(--color-neutral-200)', lineHeight: 1 }}>404</span>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-neutral-400)' }}>Page not found</p>
    </div>
  );
}

/* ── ProtectedRoute ──────────────────────────────────────── */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: 'var(--color-bg)',
      }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3px solid var(--color-neutral-200)',
          borderTopColor: 'var(--color-primary)',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}

/* ── App shell (sidebar + main) ─────────────────────────── */
function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="ns-layout">
      {/* Mobile top bar — hidden on desktop via CSS */}
      <div className="ns-mobile-topbar">
        <button
          id="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--color-neutral-200)',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span style={{ fontWeight: 700, color: 'var(--color-neutral-900)' }}>NeuroSense</span>
      </div>

      {/* Overlay backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div className="ns-mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="ns-main" id="main-content" tabIndex={-1}>
        <div className="ns-page">
          <Routes>
            <Route path="/"                element={<Dashboard />} />
            <Route path="/screening"       element={<Screening />} />
            <Route path="/screening/:category" element={<Screening />} />
            <Route path="/results"         element={<Results />} />
            <Route path="/results/:caseId" element={<Results />} />
            <Route path="/cases"           element={<Cases />} />
            <Route path="/settings"        element={<Settings />} />
            <Route path="/diagnostic"      element={<Diagnostic />} />
            <Route path="*"               element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────── */
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"     element={<Landing />} />
      <Route path="/auth" element={<Auth />} />

      {/* Protected — all /app/* routes */}
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      {/* Legacy redirects */}
      <Route path="/screening" element={<Navigate to="/app/screening" replace />} />
      <Route path="/results/*" element={<Navigate to="/app/results" replace />} />
      <Route path="/cases"     element={<Navigate to="/app/cases" replace />} />
      <Route path="/settings"  element={<Navigate to="/app/settings" replace />} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
