/** Eyebrow + title + description block used at the top of pages and marketing sections. */
export default function SectionHeader({ eyebrow, title, description, align = 'left', tone = 'light', as: Tag = 'h2', children }) {
  const dark = tone === 'dark';
  return (
    <header style={{ textAlign: align, maxWidth: align === 'center' ? 720 : 760, margin: align === 'center' ? '0 auto' : 0 }}>
      {eyebrow && <p className={`ns-eyebrow${dark ? ' ns-eyebrow--dark' : ''}`} style={{ marginBottom: 12 }}>{eyebrow}</p>}
      <Tag style={{
        fontSize: 'clamp(1.6rem, 3.4vw, 2.5rem)', letterSpacing: '-0.03em', lineHeight: 1.1,
        color: dark ? '#F4F7FB' : 'var(--ns-n900)', margin: 0,
      }}>
        {title}
      </Tag>
      {description && (
        <p style={{ marginTop: 14, fontSize: '1.02rem', lineHeight: 1.65, color: dark ? '#9FB0C8' : 'var(--ns-n600)', maxWidth: 'none' }}>
          {description}
        </p>
      )}
      {children}
    </header>
  );
}
