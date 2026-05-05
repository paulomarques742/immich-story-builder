import { useState, useEffect } from 'react';
import api from '../../lib/api.js';

export default function AlbumImporter({ storyId, onImported, onClose }) {
  const [albums, setAlbums] = useState([]);
  const [albumSearch, setAlbumSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [sharedOnly, setSharedOnly] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const h = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

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

  const filtered = albums.filter((a) => a.albumName.toLowerCase().includes(albumSearch.toLowerCase()));

  const overlayStyle = isMobile
    ? {}
    : { background: 'rgba(26,24,20,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const modalStyle = isMobile
    ? { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }
    : {
        width: 480,
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(26,24,20,0.2)',
      };

  return (
    <div
      className="fixed inset-0 z-[300]"
      style={overlayStyle}
      onClick={isMobile ? undefined : onClose}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: '14px 20px' }}>
          <h3 className="font-display text-xl italic font-light text-ink">Importar álbum Immich</h3>
          <button className="btn btn-ghost btn-sm text-ink-faint" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '16px 20px', gap: 14 }}>
          <p className="text-sm font-light text-ink-muted leading-relaxed">
            Selecciona um ou mais álbuns. A story é montada automaticamente: heros, grids dimensionados pela cadência das fotos, divisores por mês e por local.
          </p>

          <div className="flex items-center gap-4">
            <input
              className="field-input flex-1"
              placeholder="Pesquisar álbuns…"
              value={albumSearch}
              onChange={(e) => setAlbumSearch(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm font-light text-ink-muted cursor-pointer select-none shrink-0">
              <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} />
              Só partilhados
            </label>
          </div>

          {loading && <p className="text-sm font-light text-ink-faint text-center py-5">A carregar álbuns...</p>}
          {error && <p className="text-sm font-light text-danger px-3 py-2 bg-danger/6 border border-danger/20 rounded-sm">{error}</p>}

          <div className="flex flex-col" style={{ gap: 1 }}>
            {filtered.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-3 rounded-sm cursor-pointer transition-colors hover:bg-paper-warm select-none"
                style={{ padding: isMobile ? '10px 10px' : '8px 10px' }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="shrink-0"
                />
                <span className="flex-1 text-sm font-light text-ink-soft">{a.albumName}</span>
                <span className="text-xs font-light text-ink-faint shrink-0">{a.assetCount ?? 0} fotos</span>
              </label>
            ))}
            {!loading && filtered.length === 0 && !error && (
              <div className="text-center py-8">
                <p className="font-display text-lg italic font-light text-ink-faint">
                  {albumSearch ? 'Sem resultados' : 'Sem álbuns disponíveis'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between shrink-0 border-t border-border bg-paper-warm" style={{ padding: '10px 20px' }}>
          {selected.size > 0 ? (
            <span className="text-sm font-light text-ink-soft">
              <span className="font-normal">{selected.size}</span> álbum{selected.size !== 1 ? 'ns' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs font-light text-ink-faint">Nenhum álbum seleccionado</span>
          )}
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose} disabled={importing}>Cancelar</button>
            <button className="btn btn-primary" onClick={importAlbums} disabled={selected.size === 0 || importing}>
              {importing ? 'A importar…' : `Importar${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
