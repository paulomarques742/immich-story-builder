import { useState, useEffect } from 'react';
import api from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';

export default function AssetPicker({ onSelect, onClose, multiple = false, initialSelected = [] }) {
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [assets, setAssets] = useState([]);
  const [picked, setPicked] = useState(new Set(initialSelected));
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [albumError, setAlbumError] = useState('');

  useEffect(() => {
    api.get('/api/immich/albums')
      .then((r) => setAlbums(r.data))
      .catch(() => setAlbumError('Sem acesso a álbuns. Verifica a tua API key Immich.'))
      .finally(() => setLoadingAlbums(false));
  }, []);

  async function openAlbum(album) {
    setSelectedAlbum(album);
    setLoadingAssets(true);
    try {
      const r = await api.get(`/api/immich/albums/${album.id}/assets`);
      setAssets(r.data);
    } finally {
      setLoadingAssets(false);
    }
  }

  function toggle(assetId) {
    if (multiple) {
      setPicked((prev) => {
        const next = new Set(prev);
        next.has(assetId) ? next.delete(assetId) : next.add(assetId);
        return next;
      });
    } else {
      setPicked(new Set([assetId]));
    }
  }

  function confirm() {
    onSelect(multiple ? [...picked] : [...picked][0]);
    onClose();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <h3 style={s.title}>{multiple ? 'Seleccionar assets' : 'Seleccionar asset'}</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Album list */}
          <aside style={s.albumList}>
            <p style={s.sectionLabel}>Álbuns</p>
            {loadingAlbums && <p style={s.hint}>A carregar...</p>}
            {albumError && <p style={s.error}>{albumError}</p>}
            {albums.map((a) => (
              <button
                key={a.id}
                style={{ ...s.albumBtn, ...(selectedAlbum?.id === a.id ? s.albumBtnActive : {}) }}
                onClick={() => openAlbum(a)}
              >
                <span style={s.albumName}>{a.albumName}</span>
                <span style={s.albumCount}>{a.assetCount ?? ''}</span>
              </button>
            ))}
          </aside>

          {/* Asset grid */}
          <main style={s.assetArea}>
            {!selectedAlbum && !loadingAlbums && (
              <p style={s.hint}>Selecciona um álbum à esquerda</p>
            )}
            {loadingAssets && <p style={s.hint}>A carregar assets...</p>}
            {!loadingAssets && selectedAlbum && (
              <>
                {assets.length === 0 && <p style={s.hint}>Álbum vazio</p>}
                <div style={s.grid}>
                  {assets.map((a) => (
                    <div
                      key={a.id}
                      style={{ ...s.thumb, ...(picked.has(a.id) ? s.thumbSelected : {}) }}
                      onClick={() => toggle(a.id)}
                    >
                      <img src={thumbUrl(a.id)} alt="" style={s.thumbImg} />
                      {picked.has(a.id) && <div style={s.check}>✓</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <button style={s.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={s.btnPrimary} onClick={confirm} disabled={picked.size === 0}>
            {multiple ? `Confirmar (${picked.size})` : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal: { background: '#fff', borderRadius: 12, width: '88vw', maxWidth: 960, height: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 64px rgba(0,0,0,.3)' },
  header: { padding: '14px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', lineHeight: 1 },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  albumList: { width: 200, borderRight: '1px solid #eee', padding: '12px 8px', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  sectionLabel: { fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, padding: '0 6px' },
  albumBtn: { width: '100%', padding: '7px 10px', background: 'none', border: 'none', textAlign: 'left', borderRadius: 6, fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  albumBtnActive: { background: '#f0f0f0', fontWeight: 600 },
  albumName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  albumCount: { fontSize: 11, color: '#bbb', flexShrink: 0 },
  assetArea: { flex: 1, overflowY: 'auto', padding: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 6 },
  thumb: { position: 'relative', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent' },
  thumbSelected: { border: '2px solid #1a1a1a' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  check: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, background: '#1a1a1a', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  hint: { color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 32 },
  error: { color: '#c0392b', fontSize: 12, padding: '0 6px' },
  footer: { padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 },
  btnPrimary: { padding: '8px 18px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, cursor: 'pointer' },
  btnSecondary: { padding: '8px 18px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, cursor: 'pointer' },
};
