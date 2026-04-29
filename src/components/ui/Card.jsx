/**
 * Card.jsx — Premium glassmorphic card for NeuroSense.
 * Uses only tokens from src/styles/tokens.css.
 * Props: glow, hover, padding, children, style, id
 */
import { motion } from 'framer-motion';

export default function Card({ glow = false, hover = true, padding, children, style, id, ...rest }) {
  return (
    <motion.div
      id={id}
      whileHover={hover ? {
        y: -3,
        boxShadow: glow
          ? 'var(--shadow-glow), var(--shadow-lg)'
          : 'var(--shadow-lg)',
      } : {}}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--grad-card)',
        border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-lg)',
        padding: padding || 'var(--sp-6)',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {/* Top glow edge for glow=true */}
      {glow && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: '15%',
            right: '15%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--clr-primary) 50%, transparent)',
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </motion.div>
  );
}
