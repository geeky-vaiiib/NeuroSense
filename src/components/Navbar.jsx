/**
 * Navbar.jsx
 * Top navigation bar with page title, search, and action area.
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

const styles = {
  navbar: {
    height: 'var(--navbar-height)',
    backgroundColor: 'var(--color-bg-card)',
    borderBottom: '1px solid var(--color-neutral-200)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 var(--page-padding-x)',
    position: 'sticky',
    top: 0,
    zIndex: 'var(--z-raised)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-900)',
    lineHeight: 'var(--line-height-tight)',
  },
  subtitle: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-500)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 'var(--space-3)',
    color: 'var(--color-neutral-400)',
    pointerEvents: 'none',
  },
  searchInput: {
    height: '34px',
    paddingLeft: 'calc(var(--space-3) + 18px + var(--space-2))',
    paddingRight: 'var(--space-4)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-bg)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-700)',
    width: '220px',
    transition: 'all var(--transition-fast)',
  },
  iconBtn: {
    width: '34px',
    height: '34px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-neutral-500)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-neutral-200)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '7px',
    height: '7px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--color-risk-high)',
    border: '1.5px solid var(--color-bg-card)',
  },
};

export default function Navbar() {
  const { pathname } = useLocation();
  // Match exact first, then by prefix for parameterised routes like /app/results/:id
  const page =
    PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key + '/'))?.[1] ||
    { title: 'NeuroSense', subtitle: '' };
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header style={styles.navbar} role="banner">
      <div style={styles.left}>
        <h1 style={styles.title}>{page.title}</h1>
        <span style={styles.subtitle}>{page.subtitle}</span>
      </div>

      <div style={styles.right}>
        {/* Search */}
        <div style={styles.searchWrapper}>
          <span style={styles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            id="navbar-search"
            type="search"
            placeholder="Search cases…"
            style={{
              ...styles.searchInput,
              borderColor: searchFocused ? 'var(--color-primary)' : 'var(--color-neutral-200)',
              boxShadow: searchFocused ? '0 0 0 3px var(--color-primary-muted)' : 'none',
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            aria-label="Search cases"
          />
        </div>

        {/* Notifications */}
        <button
          id="navbar-notifications"
          style={styles.iconBtn}
          aria-label="Notifications (9 unread)"
          title="Notifications"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span style={styles.badge} aria-hidden="true" />
        </button>

        {/* Help */}
        <button
          id="navbar-help"
          style={styles.iconBtn}
          aria-label="Help and documentation"
          title="Help"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      </div>
    </header>
  );
}
