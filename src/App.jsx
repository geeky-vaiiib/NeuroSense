/**
 * App.jsx — Root with AuthProvider, protected routes, landing + auth pages.
 */
import { Component, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import { NeuroSenseLogo, NeuroSenseMark } from './components/branding/NeuroSenseLogo';

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
        <div role="alert" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 32 }}>
          <div className="ns-card" style={{ maxWidth: 480, padding: 36, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--ns-risk-high-bg)', color: 'var(--ns-risk-high)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
            </div>
            <h2 style={{ fontSize: '1.25rem' }}>We couldn&apos;t complete this action</h2>
            <p style={{ margin: '10px auto 22px', color: 'var(--ns-n600)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              Something unexpected happened while displaying this page. Your saved cases are not affected.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <details style={{ marginTop: 18, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--ns-n500)' }}>Technical details</summary>
              <pre style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'var(--ns-n100)', fontSize: '0.74rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--ns-n700)' }}>
                {this.state.error?.message || 'Unknown error'}
              </pre>
            </details>
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
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <NeuroSenseMark size={56} animated />
        <h2 style={{ marginTop: 20, fontSize: '1.4rem' }}>This page doesn&apos;t exist</h2>
        <p style={{ margin: '8px auto 20px', color: 'var(--ns-n500)', maxWidth: 360 }}>The link may be out of date. Head back to your dashboard.</p>
        <Link to="/app" className="btn btn-primary btn-sm">Go to dashboard</Link>
      </div>
    </div>
  );
}

/* ── ProtectedRoute ──────────────────────────────────────── */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ns-navy-900)' }}>
        <div style={{ textAlign: 'center' }}>
          <NeuroSenseMark size={56} tone="dark" animated />
          <p style={{ marginTop: 18, fontFamily: 'var(--font-data)', fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8FA3C0' }}>Restoring your session</p>
        </div>
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
  const location = useLocation();

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
        <NeuroSenseLogo size={24} />
      </div>

      {/* Overlay backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div className="ns-mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="ns-main" id="main-content" tabIndex={-1}>
        <div className="ns-page ns-page-enter" key={location.pathname.split('/').slice(0, 3).join('/')}>
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
