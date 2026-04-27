/**
 * App.jsx — Root with AuthProvider, protected routes, landing + auth pages.
 */
import React from 'react';
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
  return (
    <div className="ns-layout">
      <Sidebar />
      <main className="ns-main" id="main-content" tabIndex={-1}>
        <div className="ns-page">
          <Routes>
            <Route path="/"                element={<Dashboard />} />
            <Route path="/screening"       element={<Screening />} />
            <Route path="/results"         element={<Results />} />
            <Route path="/results/:caseId" element={<Results />} />
            <Route path="/cases"           element={<Cases />} />
            <Route path="/settings"        element={<Settings />} />
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
            <AppShell />
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
