/**
 * Sidebar.jsx
 * Primary navigation sidebar with collapsible support.
 */

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/screening',
    label: 'Screening',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    to: '/results',
    label: 'Results',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/cases',
    label: 'Cases',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M5.34 6.34L3.93 4.93M12 20v2M12 2v2" />
      </svg>
    ),
  },
];

const styles = {
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    width: 'var(--sidebar-width)',
    backgroundColor: 'var(--color-bg-sidebar)',
    borderRight: '1px solid var(--color-neutral-200)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 'var(--z-sticky)',
    transition: 'width var(--transition-base)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px var(--space-5)',
    borderBottom: '1px solid var(--color-neutral-200)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    minHeight: '64px',
  },
  logo: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: 'var(--shadow-primary)',
  },
  logoText: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-bold)',
    color: '#fff',
    letterSpacing: 'var(--letter-spacing-wider)',
    fontFamily: 'var(--font-mono)',
  },
  brandName: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-900)',
    letterSpacing: 'var(--letter-spacing-tight)',
    whiteSpace: 'nowrap',
  },
  brandSub: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-500)',
    marginTop: '1px',
    whiteSpace: 'nowrap',
  },
  nav: {
    flex: 1,
    padding: 'var(--space-4) var(--space-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    overflowY: 'auto',
  },
  navSectionLabel: {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-400)',
    letterSpacing: 'var(--letter-spacing-widest)',
    textTransform: 'uppercase',
    padding: 'var(--space-3) var(--space-3) var(--space-2)',
  },
  footer: {
    padding: 'var(--space-4) var(--space-5)',
    borderTop: '1px solid var(--color-neutral-200)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(135deg, var(--color-secondary-light), var(--color-secondary))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    color: '#fff',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-neutral-800)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-neutral-500)',
  },
};

const navLinkStyle = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
  color: isActive ? 'var(--color-primary-dark)' : 'var(--color-neutral-600)',
  backgroundColor: isActive ? 'var(--color-primary-muted)' : 'transparent',
  transition: 'all var(--transition-fast)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
});

export default function Sidebar() {
  return (
    <aside style={styles.sidebar} role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoText}>NS</span>
        </div>
        <div>
          <div style={styles.brandName}>NeuroSense</div>
          <div style={styles.brandSub}>Clinical Intelligence</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        <span style={styles.navSectionLabel}>Main</span>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => navLinkStyle(isActive)}
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? 'var(--color-primary)' : 'inherit', flexShrink: 0 }}>
                  {icon}
                </span>
                <span>{label}</span>
                {isActive && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      width: '6px',
                      height: '6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-primary)',
                    }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User */}
      <div style={styles.footer}>
        <div style={styles.avatar}>PM</div>
        <div style={styles.userInfo}>
          <div style={styles.userName}>Dr. Priya Mehta</div>
          <div style={styles.userRole}>Senior Clinician</div>
        </div>
      </div>
    </aside>
  );
}
