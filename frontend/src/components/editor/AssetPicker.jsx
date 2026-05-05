import { useState, useEffect } from 'react';
import api from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';

const NONE_ALBUM = { id: '__none__', albumName: 'Fora de álbuns' };
const CONTRIB_ALBUM = { id: '__contributions__', albumName: '📥 Contribuições' };

function AssetGrid({ assets, picked, onToggle, isMobile }) {
  const minSize = isMobile ? 78 : 92;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minSize}px, 1fr))`, gap: isMobile ? 4 : 5 }}>
      {assets.map((a) => (
        <div
          key={a.id}
          className="group relative overflow-hidden cursor-pointer"
          onClick={() => onToggle(a.id)}
          style={{
            aspectRatio: '1',
            borderRadius: isMobile ? 4 : 6,
            border: `2.5px solid ${picked.has(a.id) ? 'var(--mv-accent)' : 'transparent'}`,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: picked.has(a.id) ? '0 0 0 3px var(--mv-accent-pale)' : 'none',
          }}
        >
          <img
            src={thumbUrl(a.id)}
            alt=""
            className="w-full h-full object-cover block transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {a.type === 'VIDEO' && (
            <div className="absolute bottom-1.5 left-1.5 text-xs text-white bg-black/60 rounded-sm px-1 leading-snug">▶</div>
          )}
          {!picked.has(a.id) && (
            <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/10 transition-colors duration-200" />
          )}
          {picked.has(a.id) && (
            <div className="absolute inset-0 bg-accent/15 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-sm">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5">
                  <polyline points="2,6 5,9 10,3"/>
                </svg>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SidebarItem({ album, active, count, onClick }) {
  return (
    <button
      className="w-full flex items-center justify-between gap-2 text-left transition-all"
      style={{
        padding: '7px 8px 7px 9px',
        borderRadius: 5,
        borderLeft: `2px solid ${active ? 'var(--mv-accent)' : 'transparent'}`,
        background: active ? 'var(--mv-accent-pale)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-soft)',
      }}
      onClick={onClick}
    >
      <span className="truncate text-xs font-light">{album.albumName}</span>
      {count != null && count !== '' && (
        <span className="text-2xs font-light shrink-0" style={{ color: 'var(--ink-faint)' }}>{count}</span>
      )}
    </button>
  );
}

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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setLoadingAlbums(true);
    setAlbumError('');
    api.get(`/api/immich/albums${sharedOnly ? '?shared=true' : ''}`)
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
        const r = await api.get(`/api/immich/assets${typeFilter ? `?type=${typeFilter}` : ''}`);
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

  const visibleAssets = typeFilter ? assets.filter((a) => a.type === typeFilter) : assets;
  const filteredAlbums = albums.filter((a) => a.albumName.toLowerCase().includes(albumSearch.toLowerCase()));

  /* ── Footer (shared between layouts) ── */
  const footer = (
    <div className="flex items-center justify-between shrink-0 border-t border-border bg-paper-warm" style={{ padding: '11px 20px' }}>
      {picked.size > 0 ? (
        <span className="text-sm font-light text-ink-soft">
          <span className="font-normal">{picked.size}</span> seleccionada{picked.size !== 1 ? 's' : ''}
        </span>
      ) : (
        <span className="text-xs font-light text-ink-faint">Nenhuma seleccionada</span>
      )}
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirm} disabled={picked.size === 0}>
          {multiple ? `Confirmar${picked.size > 0 ? ` (${picked.size})` : ''}` : 'Confirmar'}
        </button>
      </div>
    </div>
  );

  /* ── Mobile layout ── */
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col" style={{ background: 'var(--paper)' }}>

        <div className="flex items-center justify-between shrink-0 border-b border-border" style={{ padding: '12px 16px' }}>
          <h3 className="font-display text-xl italic font-light text-ink">
            {multiple ? 'Seleccionar fotos' : 'Seleccionar foto'}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="shrink-0 border-b border-border" style={{ paddingTop: 10 }}>
          <div className="flex items-center gap-2" style={{ padding: '0 12px 8px' }}>
            <input
              className="field-input flex-1"
              style={{ padding: '7px 10px', fontSize: 13 }}
              placeholder="Pesquisar álbuns…"
              value={albumSearch}
              onChange={(e) => setAlbumSearch(e.target.value)}
            />
            <label className="flex items-center gap-1.5 shrink-0 text-xs font-light text-ink-muted cursor-pointer select-none">
              <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} />
              Partilhados
            </label>
          </div>
          <div className="flex gap-1.5 overflow-x-auto" style={{ padding: '0 12px 10px', scrollbarWidth: 'none' }}>
            {loadingAlbums && <span className="text-xs text-ink-faint self-center">A carregar…</span>}
            {!loadingAlbums && storyId && (
              <AlbumChip album={CONTRIB_ALBUM} active={selectedAlbum?.id === '__contributions__'} count={contribCount || null} onSelect={() => openAlbum(CONTRIB_ALBUM)} />
            )}
            {!loadingAlbums && (
              <AlbumChip album={NONE_ALBUM} active={selectedAlbum?.id === '__none__'} count={null} onSelect={() => openAlbum(NONE_ALBUM)} />
            )}
            {!loadingAlbums && filteredAlbums.map((a) => (
              <AlbumChip key={a.id} album={a} active={selectedAlbum?.id === a.id} count={a.assetCount || null} onSelect={() => openAlbum(a)} />
            ))}
            {albumError && <span className="text-xs text-danger shrink-0 self-center">{albumError}</span>}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto" style={{ padding: 10 }}>
          {!selectedAlbum && (
            <p className="text-sm font-light text-ink-faint text-center mt-12">Selecciona um álbum acima</p>
          )}
          {loadingAssets && (
            <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
          )}
          {!loadingAssets && selectedAlbum && visibleAssets.length === 0 && (
            <p className="text-sm font-light text-ink-faint text-center mt-12">Sem fotos neste álbum</p>
          )}
          {!loadingAssets && selectedAlbum && visibleAssets.length > 0 && (
            <AssetGrid assets={visibleAssets} picked={picked} onToggle={toggle} isMobile />
          )}
        </main>

        {footer}
      </div>
    );
  }

  /* ── Desktop layout ── */
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(26,24,20,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-paper border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
        style={{ width: '88vw', maxWidth: 960, height: '84vh', boxShadow: '0 24px 64px rgba(26,24,20,0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between shrink-0 border-b border-border" style={{ padding: '16px 20px 14px' }}>
          <div>
            <h3 className="font-display text-2xl italic font-light text-ink leading-none">
              {multiple ? 'Seleccionar fotos' : 'Seleccionar foto'}
            </h3>
            {selectedAlbum && !loadingAssets && (
              <p className="text-xs font-light text-ink-faint mt-1.5">
                {selectedAlbum.albumName} &middot; {visibleAssets.length} foto{visibleAssets.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button className="btn btn-ghost btn-sm text-ink-faint mt-0.5" onClick={onClose}>✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <aside className="border-r border-border flex flex-col shrink-0" style={{ width: 200, background: 'var(--paper-warm)' }}>

            {/* Search */}
            <div className="border-b border-border" style={{ padding: '8px 8px' }}>
              <input
                className="field-input"
                style={{ padding: '6px 10px', fontSize: 12 }}
                placeholder="Pesquisar álbuns…"
                value={albumSearch}
                onChange={(e) => setAlbumSearch(e.target.value)}
              />
            </div>

            {/* Todos / Partilhados toggle */}
            <div className="flex border-b border-border shrink-0">
              {[['Todos', false], ['Partilhados', true]].map(([label, val]) => (
                <button
                  key={label}
                  className="flex-1 text-xs font-light bg-transparent border-none cursor-pointer transition-colors"
                  style={{
                    padding: '7px 4px',
                    color: sharedOnly === val ? 'var(--ink)' : 'var(--ink-muted)',
                    fontWeight: sharedOnly === val ? 500 : 300,
                    borderBottom: `1.5px solid ${sharedOnly === val ? 'var(--mv-accent)' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                  onClick={() => setSharedOnly(val)}
                >{label}</button>
              ))}
            </div>

            {/* Album list */}
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '6px 6px' }}>

              {storyId && (
                <SidebarItem
                  album={CONTRIB_ALBUM}
                  active={selectedAlbum?.id === '__contributions__'}
                  count={contribCount || null}
                  onClick={() => openAlbum(CONTRIB_ALBUM)}
                />
              )}
              <SidebarItem
                album={NONE_ALBUM}
                active={selectedAlbum?.id === '__none__'}
                count={null}
                onClick={() => openAlbum(NONE_ALBUM)}
              />

              <p className="text-2xs font-medium uppercase tracking-widest text-ink-faint" style={{ padding: '10px 9px 4px' }}>Álbuns</p>

              {loadingAlbums && (
                <div className="flex items-center gap-2 text-ink-faint text-xs font-light" style={{ padding: '6px 9px' }}>
                  <div className="spinner spinner-sm" />
                  <span>A carregar…</span>
                </div>
              )}
              {albumError && <p className="text-xs text-danger" style={{ padding: '4px 9px' }}>{albumError}</p>}

              {filteredAlbums.map((a) => (
                <SidebarItem
                  key={a.id}
                  album={a}
                  active={selectedAlbum?.id === a.id}
                  count={a.assetCount ?? ''}
                  onClick={() => openAlbum(a)}
                />
              ))}

              {!loadingAlbums && filteredAlbums.length === 0 && !albumError && albumSearch && (
                <p className="text-xs font-light text-ink-faint text-center" style={{ marginTop: 16 }}>Sem resultados</p>
              )}
            </div>
          </aside>

          {/* Asset grid */}
          <main className="flex-1 overflow-y-auto" style={{ padding: 12, background: 'var(--paper)' }}>

            {!selectedAlbum && !loadingAlbums && (
              <div className="flex flex-col items-center justify-center h-full text-center" style={{ paddingBottom: 40 }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 14, opacity: 0.6 }}>
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
                <p className="font-display text-xl italic font-light text-ink-faint">Selecciona um álbum</p>
                <p className="text-xs font-light text-ink-faint mt-1">à esquerda para ver as fotos</p>
              </div>
            )}

            {loadingAssets && (
              <div className="flex items-center justify-center h-full">
                <div className="spinner" />
              </div>
            )}

            {!loadingAssets && selectedAlbum && visibleAssets.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center" style={{ paddingBottom: 40 }}>
                <p className="font-display text-xl italic font-light text-ink-faint">Sem fotos neste álbum</p>
              </div>
            )}

            {!loadingAssets && selectedAlbum && visibleAssets.length > 0 && (
              <AssetGrid assets={visibleAssets} picked={picked} onToggle={toggle} />
            )}
          </main>
        </div>

        {footer}
      </div>
    </div>
  );
}

function AlbumChip({ album, active, count, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="shrink-0 flex items-center gap-1 text-xs font-light transition-all"
      style={{
        padding: '5px 10px',
        borderRadius: 99,
        border: `1.5px solid ${active ? 'var(--mv-accent)' : 'var(--border)'}`,
        background: active ? 'var(--mv-accent)' : 'var(--paper-warm)',
        color: active ? '#fff' : 'var(--ink-soft)',
        whiteSpace: 'nowrap',
      }}
    >
      {album.albumName}
      {count > 0 && <span style={{ opacity: 0.65, marginLeft: 2 }}>{count}</span>}
    </button>
  );
}
