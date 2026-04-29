/**
 * Card.jsx — Minimal card primitive.
 * Adapted from shadcn/card for NeuroSense vanilla CSS.
 */
import { forwardRef } from 'react';

export const Card = forwardRef(({ className, style, children, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    style={{
      borderRadius: 'var(--radius-xl, 18px)',
      border: '1px solid var(--color-neutral-200)',
      backgroundColor: 'var(--color-bg-card)',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
));
Card.displayName = 'Card';

export const CardHeader = forwardRef(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '24px',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ style, children, ...props }, ref) => (
  <h3
    ref={ref}
    style={{
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-semibold)',
      lineHeight: 1,
      letterSpacing: 'var(--tracking-tight)',
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(({ style, children, ...props }, ref) => (
  <p
    ref={ref}
    style={{
      fontSize: 'var(--text-sm)',
      color: 'var(--color-neutral-500)',
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    style={{
      padding: '24px',
      paddingTop: 0,
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
));
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '24px',
      paddingTop: 0,
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
));
CardFooter.displayName = 'CardFooter';
