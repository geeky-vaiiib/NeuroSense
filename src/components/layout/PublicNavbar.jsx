/**
 * Marketing/site navbar. Transparent over the dark hero, translucent + blurred once scrolled.
 * Auth-aware: signed-out -> Sign in / Get started; signed-in -> profile menu (Settings, Sign out).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NeuroSenseLogo } from '../branding/NeuroSenseLogo';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/app/screening', label: 'Screening' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#about', label: 'About' },
  { to: '/app', label: 'Dashboard', end: true },
];

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        style={{
          width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(17,27,48,0.6)',
          color: '#E6ECF5', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.04em', cursor: 'pointer',
        }}
      >
        {user?.initials || 'U'}
      </button>
      {open && (
        <div role="menu" className="ns-card" style={{ position: 'absolute', right: 0, top: 46, minWidth: 220, padding: 8, zIndex: 400, boxShadow: 'var(--sh-lg)' }}>
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--ns-n200)', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ns-n900)' }}>{user?.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--ns-n500)', wordBreak: 'break-all' }}>{user?.email}</div>
          </div>
          <Link role="menuitem" to="/app/settings" onClick={() => setOpen(false)} className="ns-menu-item">Profile &amp; settings</Link>
          <button role="menuitem" type="button" onClick={onLogout} className="ns-menu-item" style={{ width: '100%', textAlign: 'left' }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function PublicNavbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const handleLogout = async () => { await logout(); navigate('/', { replace: true }); };

  return (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 'var(--z-sticky)', transition: 'background 240ms ease, border-color 240ms ease',
        background: scrolled || menu ? 'rgba(7,12,24,0.78)' : 'transparent',
        backdropFilter: scrolled || menu ? 'blur(16px) saturate(1.3)' : 'none',
        WebkitBackdropFilter: scrolled || menu ? 'blur(16px) saturate(1.3)' : 'none',
        borderBottom: `1px solid ${scrolled || menu ? 'rgba(148,163,184,0.16)' : 'transparent'}`,
      }}
    >
      <div className="ns-container" style={{ height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link to="/" aria-label="NeuroSense home" style={{ display: 'inline-flex' }}>
          <NeuroSenseLogo tone="dark" size={30} animated />
        </Link>

        <nav aria-label="Primary" className="ns-nav-desktop" style={{ display: 'flex', gap: 4 }}>
          {LINKS.map((l) => l.to ? (
            <NavLink key={l.label} to={l.to} end={l.end} className="ns-nav-link">{l.label}</NavLink>
          ) : (
            <a key={l.label} href={l.href} className="ns-nav-link">{l.label}</a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAuthenticated ? (
            <ProfileMenu user={user} onLogout={handleLogout} />
          ) : (
            <>
              <Link to="/auth" className="btn btn-outline-dark btn-sm ns-nav-desktop">Sign in</Link>
              <Link to="/auth?mode=register" className="btn btn-signal btn-sm">Get started</Link>
            </>
          )}
          <button
            type="button" className="ns-nav-burger" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {menu && (
        <nav aria-label="Mobile" className="ns-nav-mobile">
          {LINKS.map((l) => l.to ? (
            <NavLink key={l.label} to={l.to} end={l.end} className="ns-nav-link" onClick={() => setMenu(false)}>{l.label}</NavLink>
          ) : (
            <a key={l.label} href={l.href} className="ns-nav-link" onClick={() => setMenu(false)}>{l.label}</a>
          ))}
          {!isAuthenticated && <Link to="/auth" className="ns-nav-link" onClick={() => setMenu(false)}>Sign in</Link>}
          {isAuthenticated && <button type="button" className="ns-nav-link" style={{ textAlign: 'left' }} onClick={handleLogout}>Sign out</button>}
        </nav>
      )}

      <style>{`
        .ns-nav-link{color:#B6C4DA;font-size:.86rem;font-weight:500;padding:8px 14px;border-radius:10px;transition:color .15s,background .15s;background:none;border:none;cursor:pointer;font-family:var(--font-body)}
        .ns-nav-link:hover{color:#fff;background:rgba(148,163,184,.12)}
        .ns-nav-link.active{color:#fff}
        .ns-menu-item{display:block;padding:9px 10px;border-radius:8px;font-size:.86rem;color:var(--ns-n700);font-weight:500;background:none;border:none;cursor:pointer;font-family:var(--font-body)}
        .ns-menu-item:hover{background:var(--ns-n150);color:var(--ns-n900)}
        .ns-nav-burger{display:none;width:40px;height:40px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:transparent;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer}
        .ns-nav-burger span{width:18px;height:2px;background:#E6ECF5;border-radius:2px}
        .ns-nav-mobile{display:flex;flex-direction:column;padding:8px clamp(16px,4vw,32px) 16px;border-top:1px solid rgba(148,163,184,.14)}
        @media (max-width:860px){.ns-nav-desktop{display:none!important}.ns-nav-burger{display:flex}}
        @media (min-width:861px){.ns-nav-mobile{display:none}}
      `}</style>
    </header>
  );
}
