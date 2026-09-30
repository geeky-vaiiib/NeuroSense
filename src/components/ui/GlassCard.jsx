/** Layered surface. variant: solid (default) | glass | dark. `interactive` adds hover elevation. */
export default function GlassCard({ variant = 'solid', interactive = false, padding = 24, as: Tag = 'div', style, className = '', children, ...rest }) {
  const base = variant === 'glass' ? 'ns-glass' : variant === 'dark' ? 'ns-dark' : 'ns-card';
  return (
    <Tag
      className={`${base}${interactive ? ' ns-card--interactive' : ''} ${className}`.trim()}
      style={{ borderRadius: 'var(--r-lg)', padding, ...(variant === 'dark' ? { border: '1px solid rgba(148,163,184,0.16)' } : null), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
