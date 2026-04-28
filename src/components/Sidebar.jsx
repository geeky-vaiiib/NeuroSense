/**
 * Sidebar.jsx — Persistent 240px nav, uses AuthContext for user info + logout.
 */
import { NeuroLogo } from '../pages/Landing';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBackendStatus } from '../hooks/useBackendStatus';

const NAV_ITEMS = [
  {
    to: '/app',
    end: true,
    label: 'Dashboard',
    badge: null,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/app/screening',
    end: false,
    label: 'New Screening',
    badge: null,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    to: '/app/results',
    end: false,
    label: 'Results & XAI',
    badge: null,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    to: '/app/cases',
    end: false,
    label: 'Case History',
    badge: '9',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    to: '/app/settings',
    end: false,
    label: 'Settings',
    badge: null,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93l-1.41 1.41M5.34 17.66l-1.41 1.41M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M5.34 6.34L3.93 4.93M12 20v2M12 2v2"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isOnline, isChecking } = useBackendStatus();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className="ns-sidebar" role="navigation" aria-label="Main navigation">

      {/* Brand */}
      <div className="ns-sb-brand">
        <NeuroLogo size={34} />
        <div className="ns-sb-brand-text">
          <span className="ns-sb-app-name">NeuroSense</span>
          <span className="ns-sb-app-sub">Clinical Intelligence</span>
        </div>
      </div>

      <div className="ns-sb-divider" />

      {/* Nav */}
      <nav className="ns-sb-nav">
        <ul>
          {NAV_ITEMS.map(({ to, end, label, icon, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => isActive ? 'ns-sb-link ns-sb-link--active' : 'ns-sb-link'}
                aria-label={label}
              >
                <span className="ns-sb-link-icon">{icon}</span>
                <span className="ns-sb-link-label">{label}</span>
                {badge && (
                  <span style={{
                    marginLeft: 'auto', minWidth: '18px', height: '18px',
                    padding: '0 5px', borderRadius: '999px',
                    backgroundColor: 'var(--color-risk-moderate-muted)',
                    color: 'var(--color-risk-moderate)',
                    fontSize: '0.6875rem', fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{badge}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ flex: 1 }} />

      {/* Backend status indicator */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--color-neutral-100)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: isChecking
            ? 'var(--color-neutral-300)'
            : isOnline
              ? '#7CDE9A'
              : 'var(--color-risk-high)',
          transition: 'background-color 0.4s ease',
        }} />
        <span style={{
          fontSize: '0.72rem',
          color: 'var(--color-neutral-400)',
          fontFamily: 'var(--font-mono)',
        }}>
          {isChecking ? 'checking…' : isOnline ? 'backend connected' : 'backend offline'}
        </span>
      </div>

      <div className="ns-sb-divider" />

      {/* User strip */}
      <div style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary-dark))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 700, color: '#fff',
          position: 'relative',
        }}>
          {user?.initials ?? 'U'}
          {/* Online dot */}
          <span style={{
            position: 'absolute', bottom: '0', right: '0',
            width: '9px', height: '9px', borderRadius: '50%',
            backgroundColor: '#4CAF50',
            border: '1.5px solid var(--color-bg-sidebar)',
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-neutral-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ?? 'Clinician'}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--color-neutral-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.role ?? ''}
          </div>
        </div>

        {/* Logout button */}
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          style={{
            width: '28px', height: '28px', borderRadius: '8px',
            border: '1px solid var(--color-neutral-200)',
            backgroundColor: 'transparent',
            color: 'var(--color-neutral-400)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'all 150ms',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Compliance footer */}
      <footer className="ns-sb-footer" aria-label="Compliance notice">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>DPDP Act 2023 Compliant</span>
      </footer>
    </aside>
  );
}
