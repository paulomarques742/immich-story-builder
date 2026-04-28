import { originalUrl } from '../../lib/immich.js';

export default function VideoBlock({ content }) {
  const { asset_id, caption, autoplay = false, loop = false } = content;

  if (!asset_id) {
    return (
      <div style={s.empty}>
        <p>Sem vídeo — define o asset ID nas propriedades</p>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <video
        style={s.video}
        src={originalUrl(asset_id)}
        controls
        autoPlay={autoplay}
        loop={loop}
        playsInline
        preload="metadata"
      />
      {caption && <p style={s.caption}>{caption}</p>}
    </div>
  );
}

const s = {
  wrap: { width: '100%', background: '#111' },
  video: { width: '100%', display: 'block', maxHeight: '80vh' },
  caption: { textAlign: 'center', padding: '10px 16px', fontSize: 14, color: '#ccc', background: '#111' },
  empty: { padding: 40, textAlign: 'center', background: '#1a1a1a', color: '#555', fontSize: 14 },
};
