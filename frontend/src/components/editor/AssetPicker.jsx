import { useState, useEffect } from 'react';
import api from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';

const NONE_ALBUM = { id: '__none__', albumName: 'Fora de álbuns' };
const CONTRIB_ALBUM = { id: '__contributions__', albumName: '📥 Contribuições' };

export default function AssetPicker({ onSelect, onClose, multiple = false, initialSelected = [], typeFilter, storyId }) {
  const [albums, setAlbums] = useState([]);
  const [sharedOnly, setSharedOnly] = useState(false);
  const [albumSearch, setAlbumSearch] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [assets, setAssets] = useState([]);
  const [picked, setPicked] = useState(new Set(initialSelected));
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [albumError, setAlbumError] = useState('');
  const [contribCount, setContribCount] = useState(0);

  useEffect(() => {
    setLoadingAlbums(true);
    setAlbumError('');
    const params = sharedOnly ? '?shared=true' : '';
    api.get(`/api/immich/albums${params}`)
      .then((r) => setAlbums(r.data))
      .catch(() => setAlbumError('Sem acesso a álbuns. Verifica a tua API key Immich.'))
      .finally(() => setLoadingAlbums(false));
  }, [sharedOnly]);

  useEffect(() => {
    if (!storyId) return;
    api.get(`/api/stories/${storyId}/contributions/assets`)
      .then((r) => setContribCount(r.data.length))
      .catch(() => {});
  }, [storyId]);

  async function openAlbum(album) {
    setSelectedAlbum(album);
    setLoadingAssets(true);
    try {
      if (album.id === '__none__') {
        const params = typeFilter ? `?type=${typeFilter}` : '';
        const r = await api.get(`/api/immich/assets${params}`);
        setAssets(r.data);
      } else if (album.id === '__contributions__') {
        const r = await api.get(`/api/stories/${storyId}/contributions/assets`);
        setAssets(r.data);
        setContribCount(r.data.length);
      } else {
        const r = await api.get(`/api/immich/albums/${album.id}/assets`);
        setAssets(r.data);
      }
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

  const visibleAssets = typeFilter
    ? assets.filter((a) => a.type === typeFilter)
    : assets;

  const filteredAlbums = albums.filter((a) =>
    a.albumName.toLowerCase().includes(albumSearch.toLowerCase())
  );

  return (
    <div style={s.overlay} onClick={onClose}>
      <div className="ap-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <h3 style={s.title}>{multiple ? 'Seleccionar fotos' : 'Seleccionar foto'}</h3>
          <button className="ap-close-btn" style={s.closeBtn} onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {/* Body */}
        <div className="ap-body">

          {/* Album sidebar */}
          <aside className="ap-sidebar">

            {/* Search — hidden on mobile via CSS */}
            <div style={s.searchWrap} className="ap-search-wrap">
              <input
                className="field"
                style={s.searchInput}
                placeholder="Pesquisar álbuns…"
                value={albumSearch}
                onChange={(e) => setAlbumSearch(e.target.value)}
              />
            </div>

            {/* Toggle todos / partilhados */}
            <div style={s.toggleRow} className="ap-toggle-row">
              <button
                style={{ ...s.toggleBtn, ...(sharedOnly ? {} : s.toggleBtnActive) }}
                onClick={() => setSharedOnly(false)}
              >Todos</button>
              <button
                style={{ ...s.toggleBtn, ...(sharedOnly ? s.toggleBtnActive : {}) }}
                onClick={() => setSharedOnly(true)}
              >Partilhados</button>
            </div>

            {/* Contributions — shown only when storyId provided and there are approved ones */}
            {storyId && (
              <button
                className={`ap-album-btn${selectedAlbum?.id === '__contributions__' ? ' active' : ''}`}
                style={{ ...s.albumBtn, ...(selectedAlbum?.id === '__contributions__' ? s.albumBtnActive : {}) }}
                onClick={() => openAlbum(CONTRIB_ALBUM)}
              >
                <span style={s.albumName}>📥 Contribuições</span>
                {contribCount > 0 && <span style={s.albumCount}>{contribCount}</span>}
              </button>
            )}

            {/* Fora de álbuns */}
            <button
              className={`ap-album-btn${selectedAlbum?.id === '__none__' ? ' active' : ''}`}
              style={{ ...s.albumBtn, ...(selectedAlbum?.id === '__none__' ? s.albumBtnActive : {}) }}
              onClick={() => openAlbum(NONE_ALBUM)}
            >
              <span style={s.albumName}>📁 Fora de álbuns</span>
            </button>

            <p style={s.sectionLabel} className="ap-section-label">Álbuns</p>

            {loadingAlbums && (
              <div style={s.loadingRow}><div className="spinner spinner-sm" /><span style={s.hint}>A carregar…</span></div>
            )}
            {albumError && <p style={s.error}>{albumError}</p>}

            {filteredAlbums.map((a) => (
              <button
                key={a.id}
                className={`ap-album-btn${selectedAlbum?.id === a.id ? ' active' : ''}`}
                style={{ ...s.albumBtn, ...(selectedAlbum?.id === a.id ? s.albumBtnActive : {}) }}
                onClick={() => openAlbum(a)}
              >
                <span style={s.albumName}>{a.albumName}</span>
                <span style={s.albumCount}>{a.assetCount ?? ''}</span>
              </button>
            ))}

            {!loadingAlbums && filteredAlbums.length === 0 && !albumError && albumSearch && (
              <p style={s.hint}>Sem resultados</p>
            )}
          </aside>

          {/* Asset grid */}
          <main style={s.assetArea}>
            {!selectedAlbum && !loadingAlbums && (
              <p style={{ ...s.hint, marginTop: 32 }}>Selecciona um álbum à esquerda</p>
            )}
            {loadingAssets && (
              <div style={s.loadingCenter}><div className="spinner" /></div>
            )}
            {!loadingAssets && selectedAlbum && (
              <>
                {visibleAssets.length === 0 && <p style={s.hint}>Sem fotos neste álbum</p>}
                <div style={s.grid} className="ap-grid">
                  {visibleAssets.map((a) => (
                    <div
                      key={a.id}
                      style={{ ...s.thumb, ...(picked.has(a.id) ? s.thumbSelected : {}) }}
                      onClick={() => toggle(a.id)}
                    >
                      <img src={thumbUrl(a.id)} alt="" style={s.thumbImg} loading="lazy" />
                      {a.type === 'VIDEO' && <div style={s.videoIcon}>▶</div>}
                      {picked.has(a.id) && <div style={s.check}>✓</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="ap-footer" style={s.footer}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirm} disabled={picked.size === 0}>
            {multiple ? `Confirmar (${picked.size})` : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(26,24,20,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, backdropFilter: 'blur(3px)',
  },
  header: {
    padding: '14px 20px',
    borderBottom: '0.5px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 20, fontWeight: 500, color: 'var(--ink)',
  },
  closeBtn: {
    background: 'none', border: 'none',
    fontSize: 16, cursor: 'pointer',
    color: 'var(--ink-faint)',
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, flexShrink: 0,
    transition: 'background 0.12s, color 0.12s',
  },
  searchWrap: { marginBottom: 8 },
  searchInput: { fontSize: 12, padding: '6px 10px' },
  toggleRow: { display: 'flex', marginBottom: 8, borderBottom: '0.5px solid var(--border)' },
  toggleBtn: {
    flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 400,
    border: 'none',
    borderBottom: '1.5px solid transparent',
    background: 'none', cursor: 'pointer',
    color: 'var(--ink-muted)', transition: 'color 0.15s',
    marginBottom: -0.5,
  },
  toggleBtnActive: {
    color: 'var(--ink)',
    borderBottomColor: 'var(--mv-accent)',
    fontWeight: 500,
  },
  sectionLabel: {
    fontSize: 9, color: 'var(--ink-faint)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 4, marginTop: 8, padding: '0 6px', fontWeight: 500,
  },
  albumBtn: {
    width: '100%', padding: '9px 10px',
    background: 'none', border: 'none',
    textAlign: 'left', borderRadius: 'var(--radius-sm)',
    fontSize: 12, fontWeight: 300, cursor: 'pointer',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4,
    color: 'var(--ink-soft)',
    minHeight: 38,
  },
  albumBtnActive: { background: 'var(--mv-accent-pale)', color: 'var(--ink)' },
  albumName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  albumCount: { fontSize: 11, fontWeight: 300, color: 'var(--ink-faint)', flexShrink: 0 },
  assetArea: { flex: 1, overflowY: 'auto', padding: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 6 },
  thumb: {
    position: 'relative', aspectRatio: '1/1',
    overflow: 'hidden', borderRadius: 'var(--radius-xs)',
    cursor: 'pointer', border: '2px solid transparent',
    transition: 'border-color 0.12s',
  },
  thumbSelected: { border: '2px solid var(--mv-accent)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoIcon: {
    position: 'absolute', bottom: 4, left: 4,
    fontSize: 11, color: '#fff',
    background: 'rgba(0,0,0,.55)', borderRadius: 3,
    padding: '1px 4px', lineHeight: 1.4,
  },
  check: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20,
    background: 'var(--mv-accent)', color: '#fff',
    borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 500,
  },
  hint: { color: 'var(--ink-faint)', fontSize: 13, fontWeight: 300, textAlign: 'center', marginTop: 32, margin: 0 },
  error: { color: 'var(--danger)', fontSize: 12, padding: '0 6px' },
  loadingRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', color: 'var(--ink-faint)', fontSize: 12, fontWeight: 300 },
  loadingCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32 },
  footer: {
    padding: '12px 20px',
    borderTop: '0.5px solid var(--border)',
    background: 'var(--paper-warm)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    flexShrink: 0,
  },
};
