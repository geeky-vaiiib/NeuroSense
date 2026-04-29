/**
 * Button.jsx — Unified button primitive for NeuroSense.
 * Variants: primary | secondary | ghost | outline | danger | success
 * Sizes: sm | md | lg
 * Supports loading, disabled, left/right icons, fullWidth.
 * Uses only tokens from src/styles/tokens.css.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';

const VARIANT_STYLES = {
  primary: {
    background: 'var(--grad-cta)',
    color: 'var(--clr-text-inverse)',
    border: 'none',
    hoverShadow: '0 0 28px rgba(14,207,200,0.45)',
    shimmer: true,
  },
  secondary: {
    background: 'var(--grad-violet)',
    color: 'var(--clr-text-primary)',
    border: 'none',
    hoverShadow: '0 0 28px rgba(123,97,255,0.35)',
    shimmer: false,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--clr-text-secondary)',
    border: '1px solid var(--clr-border)',
    hoverShadow: 'none',
    shimmer: false,
  },
  outline: {
    background: 'transparent',
    color: 'var(--clr-primary)',
    border: '1px solid var(--clr-primary)',
    hoverShadow: 'none',
    shimmer: false,
  },
  danger: {
    background: 'var(--clr-danger)',
    color: 'var(--clr-text-primary)',
    border: 'none',
    hoverShadow: '0 0 28px rgba(239,68,68,0.35)',
    shimmer: false,
  },
  success: {
    background: 'var(--clr-success)',
    color: 'var(--clr-text-inverse)',
    border: 'none',
    hoverShadow: '0 0 28px rgba(34,197,94,0.35)',
    shimmer: false,
  },
};

const SIZE_STYLES = {
  sm: { height: 32, padding: '0 12px', fontSize: 'var(--text-xs)', gap: 5, iconSize: 13, borderRadius: 'var(--radius-sm)' },
  md: { height: 40, padding: '0 18px', fontSize: 'var(--text-sm)', gap: 7, iconSize: 15, borderRadius: 'var(--radius-md)' },
  lg: { height: 48, padding: '0 24px', fontSize: 'var(--text-base)', gap: 8, iconSize: 16, borderRadius: 'var(--radius-md)' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  fullWidth = false,
  onClick,
  type = 'button',
  style: externalStyle,
  children,
  id,
  'aria-label': ariaLabel,
  ...rest
}) {
  const [hovered, setHovered] = useState(false);
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const s = SIZE_STYLES[size] || SIZE_STYLES.md;
  const isDisabled = disabled || loading;

  return (
    <motion.button
      id={id}
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      aria-label={ariaLabel}
      whileHover={isDisabled ? {} : { scale: 1.025 }}
      whileTap={isDisabled ? {} : { scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        /* Layout */
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        width: fullWidth ? '100%' : 'auto',
        /* Visual */
        background: v.background,
        color: v.color,
        border: v.border,
        borderRadius: s.borderRadius,
        fontSize: s.fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        letterSpacing: '-0.01em',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        position: 'relative',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        /* Hover effects */
        boxShadow: hovered && !isDisabled ? v.hoverShadow : 'none',
        borderColor: hovered && !isDisabled && (variant === 'ghost' || variant === 'outline')
          ? 'var(--clr-text-secondary)'
          : undefined,
        transition: 'box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
        ...externalStyle,
      }}
      {...rest}
    >
      {/* Shimmer effect — primary only */}
      {v.shimmer && !isDisabled && (
        <motion.span
          initial={false}
          animate={hovered ? { x: '250%' } : { x: '-100%' }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
            transform: 'skewX(-15deg)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Loading spinner */}
      {loading && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        />
      )}

      {/* Left icon */}
      {!loading && icon && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      )}

      {/* Label */}
      {children && <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>}

      {/* Right icon */}
      {!loading && iconRight && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{iconRight}</span>
      )}
    </motion.button>
  );
}
