/** Small status pill. tone: ok | warn | bad | info | muted. Colour is never the only signal (text is required). */
export default function StatusBadge({ tone = 'muted', dot = true, children, title }) {
  return (
    <span className={`ns-badge ns-badge--${tone}`} title={title}>
      {dot && <span className="ns-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
