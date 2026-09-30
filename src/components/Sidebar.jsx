/**
 * Sidebar.jsx
 * Persistent 240px nav, uses AuthContext for user info + logout.
 * Updated to use standard tokens and clean CSS classes from index.css.
 */
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { NeuroSenseLogo } from './branding/NeuroSenseLogo';
import { useAuth } from '../context/AuthContext';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { casesApi } from '../services/api';

const NAV_ITEMS = [
  {
    to: '/app',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/app/screening',
    end: false,
    label: 'New Screening',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    to: '/app/results',
    end: false,
    label: 'Results & XAI',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    to: '/app/cases',
    end: false,
    label: 'Case History',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    to: '/app/settings',
    end: false,
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M5.34 6.34L3.93 4.93M12 20v2M12 2v2"/>
      </svg>
    ),
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { isOnline, isChecking } = useBackendStatus();
  const navigate = useNavigate();
  const [caseCount, setCaseCount] = useState(null);

  useEffect(() => {
    casesApi.list().then(list => setCaseCount(Array.isArray(list) ? list.length : 0)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className={`ns-sidebar${isOpen ? ' ns-sidebar--open' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div className="ns-sb-brand">
        <NeuroSenseLogo size={28} tone="dark" animated />
      </div>

      <div className="ns-sb-divider" />

      {/* Nav */}
      <nav className="ns-sb-nav">
        <ul>
          {NAV_ITEMS.map(({ to, end, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => isActive ? 'ns-sb-link ns-sb-link--active' : 'ns-sb-link'}
                aria-label={label}
                onClick={onClose}
              >
                <span className="ns-sb-link-icon">{icon}</span>
                <span className="ns-sb-link-label">{label}</span>
                {to === '/app/cases' && caseCount !== null && (
                  <span style={{
                    marginLeft: 'auto',
                    backgroundColor: 'rgba(148,163,184,0.14)',
                    color: 'var(--ns-n600)',
                    border: 'none',
                    borderRadius: 'var(--r-pill)',
                    padding: '1px 8px',
                    fontSize: 'var(--ts-caption)',
                    fontFamily: 'var(--font-data)',
                    fontWeight: 'var(--fw-medium)',
                  }}>
                    {caseCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ flex: 1 }} />

      {/* Backend status indicator */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)',
        borderTop: 'var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: isChecking
            ? 'var(--ns-n400)'
            : isOnline
              ? 'var(--ns-signal)'
              : 'var(--ns-risk-high)',
          transition: 'background-color var(--ease-slow)',
        }} />
        <span style={{
          fontSize: 'var(--ts-caption)',
          color: 'var(--ns-n500)',
          fontFamily: 'var(--font-data)',
        }}>
          {isChecking ? 'Checking...' : isOnline ? 'System online' : 'System offline'}
        </span>
      </div>

      <div className="ns-sb-divider" />

      {/* User strip */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      }}>
        {/* Avatar */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #0E93A0, #26365A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--ts-small)', fontWeight: 'var(--fw-semibold)', color: '#fff',
          position: 'relative',
        }}>
          {user?.initials ?? 'U'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--ts-small)', fontWeight: 'var(--fw-medium)', color: 'var(--ns-n900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ?? 'Clinician'}
          </div>
          <div style={{ fontSize: 'var(--ts-caption)', color: 'var(--ns-n500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.roleLabel ?? 'Role'}
          </div>
        </div>

        {/* Logout button */}
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          style={{
            width: '28px', height: '28px', borderRadius: 'var(--r-sm)',
            border: 'var(--border)',
            backgroundColor: 'transparent',
            color: 'var(--ns-n500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'all var(--ease-fast)',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = 'var(--ns-n900)'; e.currentTarget.style.backgroundColor = 'var(--ns-surface)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--ns-n500)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Compliance footer */}
      <footer className="ns-sb-footer" aria-label="Compliance notice">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
        <span>Screening support, not a diagnosis</span>
      </footer>
    </aside>
  );
}
