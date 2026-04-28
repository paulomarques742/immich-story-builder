import { thumbUrl } from '../../lib/immich.js';

export default function HeroBlock({ content }) {
  const { asset_id, caption, overlay = true, height = 'full', title } = content;
  const h = height === 'full' ? '100vh' : height === 'half' ? '50vh' : '340px';
  const hasOverlayContent = overlay && (title || caption);

  return (
    <div style={{ position: 'relative', height: h, background: '#111', overflow: 'hidden' }}>
      {asset_id && (
        <img
          src={thumbUrl(asset_id, 'preview')}
          alt={caption || title || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {!asset_id && (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#555', fontSize: 14 }}>Sem imagem</span>
        </div>
      )}

      {hasOverlayContent && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '48px 40px 32px',
          background: 'linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.2) 60%, transparent 100%)',
        }}>
          {title && (
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 400,
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              marginBottom: caption ? 10 : 0,
            }}>
              {title}
            </h1>
          )}
          {caption && (
            <p style={{
              fontFamily: 'var(--font-body)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
            }}>
              {caption}
            </p>
          )}
        </div>
      )}

      {!overlay && (title || caption) && (
        <div style={{ padding: '12px 20px' }}>
          {title && <p style={{ fontWeight: 600, fontSize: 15, color: '#222', marginBottom: caption ? 4 : 0 }}>{title}</p>}
          {caption && <p style={{ textAlign: 'center', fontSize: 14, color: '#555' }}>{caption}</p>}
        </div>
      )}
    </div>
  );
}
