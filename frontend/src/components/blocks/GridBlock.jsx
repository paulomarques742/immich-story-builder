import { thumbUrl } from '../../lib/immich.js';

const GAP = { sm: 4, md: 8, lg: 16 };
const ASPECT = { square: '1/1', landscape: '16/9', portrait: '3/4' };

export default function GridBlock({ content }) {
  const { asset_ids = [], columns = 3, gap = 'sm', aspect = 'square' } = content;

  if (asset_ids.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#f5f5f5', color: '#aaa', fontSize: 13 }}>
        Sem imagens — adiciona asset IDs nas propriedades
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: GAP[gap] ?? 4,
    }}>
      {asset_ids.map((assetId) => (
        <div key={assetId} style={{ aspectRatio: ASPECT[aspect] || '1/1', overflow: 'hidden', background: '#e0e0e0' }}>
          <img
            src={thumbUrl(assetId)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      ))}
    </div>
  );
}
