/**
 * App.jsx
 * Root component.
 *
 * Sets up:
 *   - BrowserRouter
 *   - App shell: Sidebar (240px) + scrollable main column
 *   - React Router v6 routes
 *
 * Active nav state lives inside Sidebar via NavLink (react-router-dom).
 * No external state library is used.
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Sidebar from './components/Sidebar';

import Dashboard from './pages/Dashboard';
import Screening from './pages/Screening';
import Results   from './pages/Results';
import Cases     from './pages/Cases';
import Settings  from './pages/Settings';

/* ── 404 fallback ────────────────────────────────────────── */
function NotFound() {
  return (
    <div
      role="main"
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            'var(--space-4)',
        height:         '60vh',
        textAlign:      'center',
        color:          'var(--color-neutral-400)',
      }}
    >
      <span
        style={{
          fontFamily:  'var(--font-mono)',
          fontSize:    'var(--font-size-4xl)',
          fontWeight:  'var(--font-weight-bold)',
          color:       'var(--color-neutral-300)',
          lineHeight:  1,
        }}
      >
        404
      </span>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-neutral-500)' }}>
        Page not found
      </p>
    </div>
  );
}

/* ── App root ─────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      {/*
        .ns-layout  →  display:flex, width:100%, min-height:100vh
        .ns-sidebar →  240px sticky column   (see index.css)
        .ns-main    →  flex:1, scrollable    (see index.css)
      */}
      <div className="ns-layout">

        {/* ── Persistent sidebar (desktop-first, never collapses) ── */}
        <Sidebar />

        {/* ── Main scrollable content area ─────────────────────── */}
        <main className="ns-main" id="main-content" tabIndex={-1}>
          <div className="ns-page">
            <Routes>
              <Route path="/"                element={<Dashboard />} />
              <Route path="/screening"       element={<Screening />} />
              {/* :caseId is optional — Results renders all or a specific case */}
              <Route path="/results"         element={<Results />} />
              <Route path="/results/:caseId" element={<Results />} />
              <Route path="/cases"           element={<Cases />} />
              <Route path="/settings"        element={<Settings />} />
              {/* Catch-all */}
              <Route path="*"               element={<NotFound />} />
            </Routes>
          </div>
        </main>

      </div>
    </BrowserRouter>
  );
}
