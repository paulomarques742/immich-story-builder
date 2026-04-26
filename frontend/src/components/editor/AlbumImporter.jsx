import { useState, useEffect } from 'react';
import api from '../../lib/api.js';

export default function AlbumImporter({ storyId, onImported, onClose }) {
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/immich/albums')
      .then((r) => setAlbums(r.data))
      .catch(() => setError('Não foi possível carregar álbuns. Verifica a tua API key Immich.'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(albumId) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(albumId) ? next.delete(albumId) : next.add(albumId);
      return next;
    });
  }

  async function importAlbums() {
    if (selected.size === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.post(`/api/stories/${storyId}/blocks/import-album`, {
        album_ids: [...selected],
      });
      onImported(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao importar álbum');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>Importar álbum Immich</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          <p style={s.desc}>
            Selecciona um ou mais álbuns. Serão criados automaticamente blocos hero, grids de 3 e divisores por mês.
          </p>

          {loading && <p style={s.hint}>A carregar álbuns...</p>}
          {error && <p style={s.error}>{error}</p>}

          <div style={s.list}>
            {albums.map((a) => (
              <label key={a.id} style={s.item}>
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  style={{ flexShrink: 0 }}
                />
                <span style={s.albumName}>{a.albumName}</span>
                <span style={s.albumCount}>{a.assetCount ?? 0} fotos</span>
              </label>
            ))}
            {!loading && albums.length === 0 && !error && (
              <p style={s.hint}>Sem álbuns disponíveis</p>
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button style={s.btnSecondary} onClick={onClose} disabled={importing}>Cancelar</button>
          <button style={s.btnPrimary} onClick={importAlbums} disabled={selected.size === 0 || importing}>
            {importing
              ? 'A importar...'
              : `Importar${selected.size > 0 ? ` (${selected.size} álbum${selected.size > 1 ? 'ns' : ''})` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
  modal: { background: '#fff', borderRadius: 12, width: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 64px rgba(0,0,0,.3)', overflow: 'hidden' },
  header: { padding: '14px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  body: { padding: '16px 20px', flex: 1, overflowY: 'auto' },
  desc: { fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.6 },
  hint: { color: '#aaa', fontSize: 13, textAlign: 'center' },
  error: { color: '#c0392b', fontSize: 13, marginBottom: 8 },
  list: { display: 'flex', flexDirection: 'column', gap: 2 },
  item: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  albumName: { flex: 1 },
  albumCount: { fontSize: 12, color: '#aaa' },
  footer: { padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 },
  btnPrimary: { padding: '8px 18px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, cursor: 'pointer' },
  btnSecondary: { padding: '8px 18px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, cursor: 'pointer' },
};
