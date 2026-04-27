const LogomarkSVG = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--ink-muted)" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="6" height="6" opacity="1" rx="0.5" />
    <rect x="8" y="0" width="6" height="6" opacity="0.6" rx="0.5" />
    <rect x="0" y="8" width="6" height="6" opacity="0.4" rx="0.5" />
    <rect x="8" y="8" width="6" height="6" opacity="0.3" rx="0.5" />
  </svg>
);

export default function ViewerFooter({ story, photoCount }) {
  const authorName = story?.author_name || story?.title || 'Anónimo';
  const createdDate = story?.created_at
    ? new Date(story.created_at).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    : '';

  return (
    <footer style={{ borderTop: '1px solid var(--paper-deep)', marginTop: '4rem' }}>
      <div className="mv-footer-inner" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '2rem 5rem', gap: '1rem',
      }}>
        {/* Logo */}
        <a href="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          textDecoration: 'none',
        }}>
          <div style={{
            width: 22, height: 22,
            background: 'var(--paper-deep)', borderRadius: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <LogomarkSVG />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '0.95rem',
            fontWeight: 400, letterSpacing: '0.04em', color: 'var(--ink-muted)',
          }}>Memoire</span>
        </a>

        {/* Meta */}
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 300,
          color: 'var(--ink-faint)', textAlign: 'right', lineHeight: 1.8,
        }}>
          {photoCount > 0 ? `${photoCount} fotografias` : 'Imagens Immich'}
          {createdDate && ` · ${createdDate}`}
          {authorName && (
            <><br />Criado por {authorName}</>
          )}
        </p>
      </div>
    </footer>
  );
}
