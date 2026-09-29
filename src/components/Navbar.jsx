/**
 * Navbar.jsx
 * Top navigation bar with page title, search, and action area.
 * Updated to use new tokens and CSS classes.
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/app':              { title: 'Dashboard',  subtitle: 'Overview of clinical activity' },
  '/app/screening':    { title: 'Screening',  subtitle: 'Administer and manage assessments' },
  '/app/results':      { title: 'Results',    subtitle: 'Review SHAP-explained outcomes' },
  '/app/cases':        { title: 'Cases',      subtitle: 'Patient case management' },
  '/app/settings':     { title: 'Settings',   subtitle: 'Preferences and configuration' },
};

export default function Navbar() {
  const { pathname } = useLocation();
  const page =
    PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key + '/'))?.[1] ||
    { title: 'NeuroSense', subtitle: '' };
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header
      role="banner"
      style={{
        height: 'var(--navbar-height)',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderBottom: 'var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--sp-8)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <h1 style={{
          fontSize: 'var(--ts-h2)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--ns-n900)',
          lineHeight: 'var(--lh-tight)',
          margin: 0,
          letterSpacing: 'var(--ls-snug)',
        }}>
          {page.title}
        </h1>
        <span style={{ fontSize: 'var(--ts-small)', color: 'var(--ns-n500)' }}>
          {page.subtitle}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 'var(--sp-3)', color: 'var(--ns-n400)', pointerEvents: 'none', lineHeight: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            id="navbar-search"
            type="search"
            placeholder="Search cases…"
            className="field-input"
            style={{
              paddingLeft: '34px',
              paddingTop: '6px',
              paddingBottom: '6px',
              width: '240px',
              borderRadius: 'var(--r-pill)',
              backgroundColor: 'var(--ns-surface-2)',
              border: '1px solid transparent',
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            aria-label="Search cases"
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {/* Notifications */}
          <button
            id="navbar-notifications"
            className="btn btn-ghost"
            style={{ padding: 'var(--sp-2)', borderRadius: 'var(--r-md)', color: 'var(--ns-n500)', position: 'relative' }}
            aria-label="Notifications (9 unread)"
            title="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <span style={{
              position: 'absolute', top: 6, right: 6, width: 8, height: 8,
              borderRadius: '50%', backgroundColor: 'var(--ns-risk-high)',
              border: '1.5px solid var(--ns-panel)'
            }} aria-hidden="true" />
          </button>

          {/* Help */}
          <button
            id="navbar-help"
            className="btn btn-ghost"
            style={{ padding: 'var(--sp-2)', borderRadius: 'var(--r-md)', color: 'var(--ns-n500)' }}
            aria-label="Help and documentation"
            title="Help"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
