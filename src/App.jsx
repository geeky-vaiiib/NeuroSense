/**
 * App.jsx
 * Root component — sets up React Router v6 routes and app shell layout.
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

import Dashboard from './pages/Dashboard';
import Screening from './pages/Screening';
import Results from './pages/Results';
import Cases from './pages/Cases';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Fixed left sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="app-main">
          <Navbar />
          <div className="page-content">
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/screening" element={<Screening />} />
              <Route path="/results"   element={<Results />} />
              <Route path="/cases"     element={<Cases />} />
              <Route path="/settings"  element={<Settings />} />
              {/* Fallback */}
              <Route
                path="*"
                element={
                  <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--color-neutral-400)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-4)', color: 'var(--color-neutral-700)' }}>404</h2>
                    <p>Page not found.</p>
                  </div>
                }
              />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
