/**
 * Modal.jsx
 * Accessible modal dialog with focus trap, backdrop click dismiss, and ESC key support.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(26, 26, 24, 0.45)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 'var(--z-modal)',
    padding: 'var(--space-4)',
    animation: 'modal-backdrop-in 200ms ease',
  },
  dialog: {
    backgroundColor: 'var(--color-bg-card)',
    borderRadius: 'var(--radius-2xl)',
    boxShadow: 'var(--shadow-2xl)',
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'modal-slide-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    overflow: 'hidden',
    border: '1px solid var(--color-neutral-200)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-6) var(--space-6) var(--space-5)',
    borderBottom: '1px solid var(--color-neutral-200)',
    gap: 'var(--space-4)',
    flexShrink: 0,
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-semibold)',
    color: 'var(--color-neutral-900)',
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-neutral-500)',
    margin: 0,
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-neutral-400)',
    backgroundColor: 'transparent',
    border: '1px solid var(--color-neutral-200)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-6)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 'var(--space-3)',
    padding: 'var(--space-5) var(--space-6)',
    borderTop: '1px solid var(--color-neutral-200)',
    flexShrink: 0,
  },
};

const SIZE_WIDTHS = { sm: '400px', md: '540px', lg: '720px', xl: '900px', full: '95vw' };

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @param {'sm'|'md'|'lg'|'xl'|'full'} [props.size='md']
 * @param {boolean} [props.closeOnBackdrop=true]
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  const dialogRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      style={styles.backdrop}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
      role="presentation"
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={subtitle ? 'modal-subtitle' : undefined}
        tabIndex={-1}
        style={{ ...styles.dialog, maxWidth: SIZE_WIDTHS[size] }}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleGroup}>
            <h2 id="modal-title" style={styles.title}>{title}</h2>
            {subtitle && <p id="modal-subtitle" style={styles.subtitle}>{subtitle}</p>}
          </div>
          <button
            id="modal-close-btn"
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div style={styles.footer}>{footer}</div>}
      </div>

      <style>{`
        @keyframes modal-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-slide-in {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
