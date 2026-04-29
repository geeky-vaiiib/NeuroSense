/**
 * Navbar.jsx — Premium frosted-glass navigation bar.
 * Dark health-tech aesthetic. Framer Motion animations.
 * Uses only tokens from src/styles/tokens.css.
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/* ── NAV LINKS ──────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Dashboard',  to: '/app' },
  { label: 'Screening',  to: '/app/screening' },
  { label: 'Results',    to: '/app/results' },
  { label: 'Cases',      to: '/app/cases' },
  { label: 'Settings',   to: '/app/settings' },
];

/* ── LOGO ───────────────────────────────────────────────── */
function Logo() {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      {/* Animated mark */}
      <motion.div
        whileHover={{ rotate: 15, scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: 'var(--grad-cta)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: 'var(--shadow-glow)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer sweep on mount */}
        <motion.span
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ delay: 0.8, duration: 0.6, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '40%',
            height: '100%',
            background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)',
            transform: 'skewX(-15deg)',
          }}
        />
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="3.5" fill="var(--clr-bg)" />
          <circle cx="10" cy="10" r="2" fill="white" />
          <path
            d="M10 2.5V5.5M10 14.5V17.5M2.5 10H5.5M14.5 10H17.5
               M4.7 4.7L6.8 6.8M13.2 13.2L15.3 15.3
               M15.3 4.7L13.2 6.8M6.8 13.2L4.7 15.3"
            stroke="var(--clr-bg)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* Wordmark */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '1.125rem',
          letterSpacing: '-0.04em',
          color: 'var(--clr-text-primary)',
          userSelect: 'none',
        }}
      >
        Neuro
        <span
          style={{
            background: 'var(--grad-cta)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Sense
        </span>
      </span>
    </Link>
  );
}

/* ── NAV LINK ITEM ──────────────────────────────────────── */
function NavLink({ to, label, isActive }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize: 'var(--text-sm)',
        color: isActive ? 'var(--clr-primary)' : 'var(--clr-text-secondary)',
        textDecoration: 'none',
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--clr-primary-dim)' : 'transparent',
        transition: 'color var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out)',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {label}
      {/* Animated underline on hover (slides in from left) */}
      <motion.span
        initial={false}
        animate={{
          scaleX: hovered && !isActive ? 1 : 0,
          opacity: hovered && !isActive ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          bottom: 2,
          left: 12,
          right: 12,
          height: 1.5,
          background: 'var(--clr-primary)',
          borderRadius: 'var(--radius-pill)',
          transformOrigin: 'left center',
        }}
      />
    </Link>
  );
}

/* ── HAMBURGER BUTTON ───────────────────────────────────── */
function HamburgerButton({ isOpen, onClick }) {
  const lineProps = {
    width: 22,
    height: 1.5,
    rx: 1,
    fill: 'var(--clr-text-primary)',
  };

  return (
    <button
      id="navbar-hamburger"
      onClick={onClick}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      style={{
        display: 'none', /* shown via CSS media query */
        background: 'transparent',
        border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-sm)',
        width: 40,
        height: 40,
        cursor: 'pointer',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
      }}
      className="navbar-hamburger-btn"
    >
      <svg width="22" height="16" viewBox="0 0 22 16" overflow="visible">
        <motion.rect
          {...lineProps}
          animate={isOpen
            ? { y: 7.25, rotate: 45, transformOrigin: 'center' }
            : { y: 0, rotate: 0, transformOrigin: 'center' }
          }
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.rect
          {...lineProps}
          animate={isOpen
            ? { opacity: 0, x: -8 }
            : { opacity: 1, x: 0 }
          }
          transition={{ duration: 0.2 }}
          y="7.25"
        />
        <motion.rect
          {...lineProps}
          animate={isOpen
            ? { y: 7.25, rotate: -45, transformOrigin: 'center' }
            : { y: 14.5, rotate: 0, transformOrigin: 'center' }
          }
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
    </button>
  );
}

/* ── MOBILE OVERLAY MENU ────────────────────────────────── */
function MobileMenu({ isOpen, onClose }) {
  const location = useLocation();

  // Close menu on route change
  useEffect(() => {
    if (isOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 },
    },
    exit: { opacity: 0, transition: { duration: 0.25 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(7, 9, 15, 0.95)',
            backdropFilter: 'blur(40px) saturate(150%)',
            WebkitBackdropFilter: 'blur(40px) saturate(150%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-8)',
          }}
        >
          <motion.nav
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--sp-6)',
            }}
          >
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.to ||
                (link.to !== '/app' && location.pathname.startsWith(link.to + '/'));
              return (
                <motion.div key={link.to} variants={itemVariants}>
                  <Link
                    to={link.to}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 700,
                      color: isActive ? 'var(--clr-primary)' : 'var(--clr-text-primary)',
                      textDecoration: 'none',
                      letterSpacing: '-0.02em',
                      transition: 'color var(--dur-base) var(--ease-out)',
                    }}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              );
            })}

            {/* Mobile CTA */}
            <motion.div variants={itemVariants} style={{ marginTop: 'var(--sp-4)' }}>
              <Link
                to="/app/screening"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 'var(--text-base)',
                  color: 'var(--clr-text-inverse)',
                  background: 'var(--grad-cta)',
                  padding: '12px 32px',
                  borderRadius: 'var(--radius-pill)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-glow)',
                }}
              >
                Start Screening
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </motion.div>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── MAIN NAVBAR ────────────────────────────────────────── */
export default function Navbar() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll(); // initial check
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <motion.nav
        id="main-navbar"
        role="banner"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 clamp(1.25rem, 4vw, 3rem)',
          background: scrolled
            ? 'rgba(7, 9, 15, 0.88)'
            : 'rgba(7, 9, 15, 0.4)',
          backdropFilter: scrolled
            ? 'blur(20px) saturate(180%)'
            : 'blur(12px) saturate(120%)',
          WebkitBackdropFilter: scrolled
            ? 'blur(20px) saturate(180%)'
            : 'blur(12px) saturate(120%)',
          borderBottom: scrolled
            ? '1px solid var(--clr-border)'
            : '1px solid transparent',
          boxShadow: scrolled
            ? '0 8px 32px rgba(0, 0, 0, 0.5)'
            : 'none',
          transition: 'all var(--dur-slow) cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 1280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* ── Left: Logo ── */}
          <Logo />

          {/* ── Center: Links (hidden on mobile via CSS) ── */}
          <div className="navbar-links-desktop" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-1)',
          }}>
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.to ||
                (link.to !== '/app' && pathname.startsWith(link.to + '/'));
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  label={link.label}
                  isActive={isActive}
                />
              );
            })}
          </div>

          {/* ── Right: CTA + Hamburger ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            {/* CTA Button (hidden on mobile via CSS) */}
            <motion.div
              className="navbar-cta-desktop"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                to="/app/screening"
                id="navbar-cta"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--clr-text-inverse)',
                  background: 'var(--grad-cta)',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-pill)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'box-shadow var(--dur-base) var(--ease-out)',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Start Screening
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </motion.div>

            {/* Hamburger (shown on mobile via CSS) */}
            <HamburgerButton
              isOpen={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            />
          </div>
        </div>
      </motion.nav>

      {/* Mobile overlay menu */}
      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* ── Responsive CSS ── */}
      <style>{`
        /* Desktop: show links and CTA, hide hamburger */
        .navbar-links-desktop { display: flex !important; }
        .navbar-cta-desktop { display: block !important; }
        .navbar-hamburger-btn { display: none !important; }

        @media (max-width: 768px) {
          .navbar-links-desktop { display: none !important; }
          .navbar-cta-desktop { display: none !important; }
          .navbar-hamburger-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}
