import { thumbUrl } from '../../lib/immich.js';

export default function HeroBlock({ content }) {
  const { asset_id, caption, overlay = true, height = 'full' } = content;
  const h = height === 'full' ? '100vh' : height === 'half' ? '50vh' : '340px';

  return (
    <div style={{ position: 'relative', height: h, background: '#111', overflow: 'hidden' }}>
      {asset_id && (
        <img
          src={thumbUrl(asset_id, 'preview')}
          alt={caption || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {!asset_id && (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#555', fontSize: 14 }}>Sem imagem</span>
        </div>
      )}
      {overlay && caption && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 32px', background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 100%)' }}>
          <p style={{ color: '#fff', fontSize: 20, fontWeight: 500 }}>{caption}</p>
        </div>
      )}
      {!overlay && caption && (
        <p style={{ textAlign: 'center', padding: '10px 16px', fontSize: 14, color: '#555' }}>{caption}</p>
      )}
    </div>
  );
}
