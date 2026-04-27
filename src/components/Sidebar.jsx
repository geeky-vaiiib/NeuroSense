/**
 * Sidebar.jsx
 * Persistent 240-px navigation sidebar.
 *
 * Active state managed entirely with React state (useLocation via
 * react-router-dom) — no external state library.
 *
 * Desktop-first: does NOT collapse on small viewports (by design).
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────
   Navigation items — icon is a tiny inline SVG path string
   ───────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/screening',
    end: false,
    label: 'New Screening',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    to: '/results',
    end: false,
    label: 'Results & XAI',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/cases',
    end: false,
    label: 'Case History',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    to: '/settings',
    end: false,
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M20 12h2M2 12h2
                 M19.07 19.07l-1.41-1.41M5.34 6.34L3.93 4.93M12 20v2M12 2v2" />
      </svg>
    ),
  },
];

/* ─────────────────────────────────────────────────────────────
   Sidebar component
   ───────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="ns-sidebar" role="navigation" aria-label="Main navigation">

      {/* ── Logo / Brand ─────────────────────────────────────── */}
      <div className="ns-sb-brand">
        {/* Green square logo mark */}
        <span className="ns-sb-logomark" aria-hidden="true">N</span>
        <div className="ns-sb-brand-text">
          <span className="ns-sb-app-name">NeuroSense</span>
          <span className="ns-sb-app-sub">Clinical Intelligence</span>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="ns-sb-divider" />

      {/* ── Navigation list ──────────────────────────────────── */}
      <nav className="ns-sb-nav">
        <ul>
          {NAV_ITEMS.map(({ to, end, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? 'ns-sb-link ns-sb-link--active' : 'ns-sb-link'
                }
                aria-label={label}
                aria-current={pathname === to || (!end && pathname.startsWith(to))
                  ? 'page' : undefined}
              >
                <span className="ns-sb-link-icon">{icon}</span>
                <span className="ns-sb-link-label">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Spacer pushes footer to bottom ───────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Divider ──────────────────────────────────────────── */}
      <div className="ns-sb-divider" />

      {/* ── Compliance footer ─────────────────────────────────── */}
      <footer className="ns-sb-footer" aria-label="Compliance notice">
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>DPDP Act 2023 Compliant</span>
      </footer>

    </aside>
  );
}
