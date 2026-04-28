import { useState, useEffect } from 'react';
import api from '../../lib/api.js';

export default function AlbumImporter({ storyId, onImported, onClose }) {
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [sharedOnly, setSharedOnly] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/api/immich/albums${sharedOnly ? '?shared=true' : ''}`)
      .then((r) => setAlbums(r.data))
      .catch(() => setError('Não foi possível carregar álbuns. Verifica a tua API key Immich.'))
      .finally(() => setLoading(false));
  }, [sharedOnly]);

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

          <label style={s.filterRow}>
            <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} />
            Só álbuns partilhados
          </label>

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
          <button className="btn btn-secondary" onClick={onClose} disabled={importing}>Cancelar</button>
          <button className="btn btn-primary" onClick={importAlbums} disabled={selected.size === 0 || importing}>
            {importing
              ? 'A importar…'
              : `Importar${selected.size > 0 ? ` (${selected.size} álbum${selected.size > 1 ? 'ns' : ''})` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, backdropFilter: 'blur(2px)',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    width: 480, maxWidth: 'calc(100vw - 2rem)', maxHeight: '72vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: { fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' },
  closeBtn: {
    background: 'none', border: 'none',
    fontSize: 16, cursor: 'pointer',
    color: 'var(--text-faint)',
    width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6,
  },
  body: { padding: '16px 20px', flex: 1, overflowY: 'auto' },
  desc: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 },
  hint: { color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  error: {
    color: 'var(--danger)', fontSize: 13, marginBottom: 8,
    padding: '8px 12px', background: '#fef2f2', borderRadius: 'var(--radius-sm)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 1 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: 14,
    transition: 'background 0.1s',
  },
  albumName: { flex: 1, fontWeight: 500, fontSize: 13 },
  albumCount: { fontSize: 12, color: 'var(--text-faint)' },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 12, color: 'var(--text-muted)',
    marginBottom: 14, cursor: 'pointer',
    fontWeight: 500,
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    flexShrink: 0,
  },
};
