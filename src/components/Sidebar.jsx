/**
 * Sidebar.jsx — ASD-friendly persistent navigation with smooth transitions.
 * 260px fixed width, clear visual hierarchy, 48px min touch targets.
 */
import { useEffect, useState } from 'react';
import NeuroLogo from './NeuroLogo';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBackendStatus } from '../hooks/useBackendStatus';
import ThemeToggle from './ThemeToggle';
import { casesApi } from '../services/api';

/* ── Grouped navigation items ─────────────────────────────── */
const SCREENING_ITEMS = [
  {
    to: '/app',
    end: true,
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
      </svg>
    ),
  },
  {
    to: '/app/results',
    end: false,
    label: 'Results & XAI',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    to: '/app/cases',
    end: false,
    label: 'Case History',
    hasCaseBadge: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
      </svg>
    ),
  },
];

const SYSTEM_ITEMS = [
  {
    to: '/app/settings',
    end: false,
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
  {
    to: '/app/diagnostic',
    end: false,
    label: 'Diagnostic',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
];

function NavItem({ to, end, label, icon, hasCaseBadge, caseCount, onClose }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) => isActive ? 'ns-sb-link ns-sb-link--active' : 'ns-sb-link'}
        aria-label={label}
        onClick={onClose}
      >
        <span className="ns-sb-link-icon">{icon}</span>
        <span className="ns-sb-link-label">{label}</span>
        {hasCaseBadge && caseCount !== null && (
          <span style={{
            marginLeft: 'auto',
            backgroundColor: 'var(--color-primary-muted)',
            color: 'var(--color-primary-dark)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            minWidth: '22px',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            {caseCount}
          </span>
        )}
      </NavLink>
    </li>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { isOnline, isChecking } = useBackendStatus();
  const navigate = useNavigate();
  const [caseCount, setCaseCount] = useState(null);

  useEffect(() => {
    casesApi.list().then(list => setCaseCount(Array.isArray(list) ? list.length : 0)).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className={`ns-sidebar${isOpen ? ' ns-sidebar--open' : ''}`} role="navigation" aria-label="Main navigation">

      {/* Brand */}
      <div style={{ padding: 'var(--space-5) var(--space-4) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
        <NeuroLogo variant="full" size={28} color="teal" />
      </div>

      {/* Nav */}
      <nav className="ns-sb-nav">
        {/* SCREENING section */}
        <div className="ns-sb-section-label">Screening</div>
        <ul>
          {SCREENING_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} caseCount={caseCount} onClose={onClose} />
          ))}
        </ul>

        {/* Section divider */}
        <div className="ns-sb-section-divider" />

        {/* SYSTEM section */}
        <div className="ns-sb-section-label">System</div>
        <ul>
          {SYSTEM_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} caseCount={caseCount} onClose={onClose} />
          ))}
        </ul>
      </nav>

      <div style={{ flex: 1 }} />

      {/* Backend status */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--color-neutral-100)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: isChecking
            ? 'var(--color-neutral-300)'
            : isOnline
              ? 'var(--color-primary)'
              : 'var(--color-risk-high)',
          transition: 'background-color 400ms var(--ease-out)',
          boxShadow: isOnline && !isChecking
            ? '0 0 0 3px var(--color-primary-muted)'
            : 'none',
        }} />
        <span style={{
          fontSize: '0.6875rem',
          color: 'var(--color-neutral-400)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.01em',
        }}>
          {isChecking ? 'checking…' : isOnline ? 'backend connected' : 'backend offline'}
        </span>
      </div>

      {/* Theme toggle */}
      <div style={{
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <ThemeToggle size={32} />
        <span style={{
          fontSize: '0.6875rem',
          color: 'var(--color-neutral-400)',
          fontWeight: 500,
        }}>Theme</span>
      </div>

      <div className="ns-sb-divider" />

      {/* User profile strip */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        cursor: 'pointer',
      }}>
        {/* Avatar: initials in a circle */}
        <div style={{
          width: 32, height: 32,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, var(--color-primary-400), var(--color-primary-700))',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-semibold)',
          fontFamily: 'var(--font-body)',
          flexShrink: 0,
        }}>
          {user?.name?.slice(0, 2).toUpperCase() || 'NS'}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--color-neutral-800)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{user?.name || 'Clinician'}</div>
          <div style={{
            fontSize: 'var(--text-2xs)',
            color: 'var(--color-neutral-400)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{user?.role || 'Clinical Reviewer'}</div>
        </div>

        {/* Sign out icon button */}
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          style={{
            padding: 'var(--space-1)',
            borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'transparent',
            color: 'var(--color-neutral-400)',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 200ms var(--ease-out)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'var(--color-neutral-100)';
            e.currentTarget.style.color = 'var(--color-neutral-600)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-neutral-400)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Compliance footer */}
      <footer className="ns-sb-footer" aria-label="Compliance notice">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-primary)' }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>DPDP Act 2023 Compliant</span>
      </footer>
    </aside>
  );
}
