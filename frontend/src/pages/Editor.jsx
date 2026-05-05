import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { thumbUrl, originalUrl } from '../lib/immich.js';
import SortableBlockList from '../components/editor/SortableBlockList.jsx';
import BlockEditor from '../components/editor/BlockEditor.jsx';
import BlockToolbar from '../components/editor/BlockToolbar.jsx';
import AlbumImporter from '../components/editor/AlbumImporter.jsx';
import AiLayoutButton from '../components/editor/AiLayoutButton.jsx';
import ThemePicker from '../components/editor/ThemePicker.jsx';
import StorySettingsModal from '../components/editor/StorySettingsModal.jsx';
import ContributionsPanel from '../components/editor/ContributionsPanel.jsx';
import { listContributions } from '../lib/api.js';
import { useAiLayout } from '../hooks/useAiLayout.js';
import ViewerBlock from '../components/viewer/ViewerBlock.jsx';
import { buildThemeVars, getTheme } from '../lib/themes.js';

const BLOCK_TYPES = ['hero', 'grid', 'text', 'quote', 'map', 'video', 'divider', 'spacer'];

const BLOCK_ICONS = { hero: '🖼', grid: '▦', text: '¶', quote: '"', map: '📍', video: '▶', divider: '—', spacer: '↕' };

const DEFAULT_CONTENT = {
  hero:    { asset_id: '', caption: '', overlay: true, height: 'full', title: '' },
  grid:    { asset_ids: [], columns: 3, gap: 'sm', aspect: 'square' },
  text:    { markdown: '', align: 'left', max_width: 'prose' },
  quote:   { quote: '', author: '' },
  map:     { mode: 'manual', lat: null, lng: null, zoom: 12, label: '' },
  video:   { asset_id: '', caption: '', autoplay: false, loop: false },
  divider: { style: 'line', label: '' },
  spacer:  { height: 'md' },
};

const editorThumbUrl = (_slug, assetId, size) => thumbUrl(assetId, size);
const editorOriginalUrl = (_slug, assetId) => originalUrl(assetId);

function BlockInsertZone({ afterIdx, insertMenuIdx, setInsertMenuIdx, onAdd }) {
  const isOpen = insertMenuIdx === afterIdx;
  return (
    <div className="block-insert-zone" onClick={(e) => e.stopPropagation()}>
      <button
        className="insert-btn w-6 h-6 rounded-full border border-border-strong bg-paper text-ink-muted text-base leading-none cursor-pointer flex items-center justify-center shadow-xs z-[5] relative"
        onClick={() => setInsertMenuIdx(isOpen ? null : afterIdx)}
        title="Adicionar bloco"
      >
        +
      </button>
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-paper border border-border rounded shadow-md z-50 overflow-hidden"
             style={{ minWidth: 160 }}>
          {BLOCK_TYPES.map((t) => (
            <button
              key={t}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-transparent border-none text-left text-base font-light cursor-pointer text-ink-soft transition-colors hover:bg-paper-warm"
              onClick={() => { onAdd(t, afterIdx); setInsertMenuIdx(null); }}
            >
              <span className="text-md text-center shrink-0" style={{ width: 18 }}>{BLOCK_ICONS[t]}</span>
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 720px)').matches);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(!window.matchMedia('(max-width: 720px)').matches);
  const [insertMenuIdx, setInsertMenuIdx] = useState(null);
  const [showImporter, setShowImporter] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContribs, setShowContribs] = useState(false);
  const [pendingContribs, setPendingContribs] = useState(0);
  const [syncCount, setSyncCount] = useState(0);

  const aiLayout = useAiLayout(id, async () => {
    const res = await api.get(`/api/stories/${id}/blocks`);
    setBlocks(res.data);
    setSelected(null);
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const handler = (e) => { setIsMobile(e.matches); if (e.matches) setRightOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get(`/api/stories/${id}`),
      api.get(`/api/stories/${id}/blocks`),
      api.get(`/api/stories/${id}/sync/status`).catch(() => ({ data: { new_asset_count: 0 } })),
      listContributions(id, 'pending').catch(() => ({ data: [] })),
    ]).then(([sRes, bRes, syncRes, contribRes]) => {
      setStory(sRes.data);
      setBlocks(bRes.data);
      setSyncCount(syncRes.data.new_asset_count || 0);
      setPendingContribs(contribRes.data.length || 0);
    }).finally(() => setLoading(false));
  }, [id]);

  async function addBlockAt(type, afterIdx) {
    const res = await api.post(`/api/stories/${id}/blocks`, {
      type,
      content: DEFAULT_CONTENT[type] || {},
    });
    const newBlock = res.data;
    const insertPos = afterIdx + 1;
    const newBlocks = [
      ...blocks.slice(0, insertPos),
      newBlock,
      ...blocks.slice(insertPos),
    ];
    setBlocks(newBlocks);
    setSelected(newBlock.id);
    if (!rightOpen) setRightOpen(true);
    await api.post(`/api/stories/${id}/blocks/reorder`, {
      ordered_ids: newBlocks.map((b) => b.id),
    });
  }

  const updateBlock = useCallback(async (blockId, content) => {
    const res = await api.put(`/api/stories/${id}/blocks/${blockId}`, { content });
    setBlocks((b) => b.map((bl) => bl.id === blockId ? res.data : bl));
  }, [id]);

  async function deleteBlock(blockId) {
    await api.delete(`/api/stories/${id}/blocks/${blockId}`);
    setBlocks((b) => b.filter((bl) => bl.id !== blockId));
    if (selected === blockId) setSelected(null);
  }

  async function handleReorder(reordered) {
    setBlocks(reordered);
    await api.post(`/api/stories/${id}/blocks/reorder`, {
      ordered_ids: reordered.map((b) => b.id),
    });
  }

  async function togglePublish() {
    setSaving(true);
    try {
      const res = await api.post(`/api/stories/${id}/publish`);
      setStory((s) => ({ ...s, published: res.data.published ? 1 : 0 }));
    } finally {
      setSaving(false);
    }
  }

  function handleImported(updatedBlocks) {
    setBlocks(updatedBlocks);
    setSelected(null);
  }

  async function dismissSync() {
    await api.post(`/api/stories/${id}/sync/dismiss`);
    setSyncCount(0);
  }

  function selectBlock(blockId) {
    setSelected(blockId);
    setInsertMenuIdx(null);
    if (!rightOpen) setRightOpen(true);
  }

  const selectedBlock = blocks.find((b) => b.id === selected);

  useEffect(() => {
    if (!story?.theme) return;
    const config = typeof story.theme === 'string' ? JSON.parse(story.theme) : story.theme;
    const theme = getTheme(config.id);
    if (!theme.googleFontsUrl) return;
    const linkId = `theme-font-${theme.id}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = theme.googleFontsUrl;
    document.head.appendChild(link);
  }, [story?.theme]);

  const themeVars = story ? buildThemeVars(story.theme) : {};
  const canvasStyle = isMobile
    ? { maxWidth: 900, margin: '0 auto', padding: '0 1rem' }
    : { maxWidth: 900, margin: '0 auto', padding: '0 2rem' };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="spinner" style={{ marginBottom: 16 }} />
      <span className="text-base font-light text-ink-faint">A carregar editor…</span>
    </div>
  );
  if (!story) return (
    <div className="flex items-center justify-center h-screen text-base text-ink-muted">
      Story não encontrada.
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-paper-warm">

      {/* ── Top toolbar ── */}
      <header className="bg-paper border-b border-border h-toolbar flex items-center shrink-0 z-10"
              style={{ gap: 6, padding: '0 12px' }}>

        {/* Back */}
        <button className="btn btn-ghost btn-sm shrink-0" onClick={() => navigate('/dashboard')}>
          ← {!isMobile && 'Dashboard'}
        </button>

        <span className="w-px h-5 bg-paper-deep shrink-0" style={{ margin: '0 4px' }} />

        {/* Story title — clickable, uses display font */}
        <button
          className="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left rounded-sm transition-colors hover:bg-paper-warm"
          style={{ padding: '5px 8px' }}
          onClick={() => setShowSettings(true)}
          title="Editar definições da story"
        >
          <span className="font-display italic font-light text-ink block truncate" style={{ fontSize: 17, lineHeight: 1.2 }}>
            {story.title}
          </span>
          {!isMobile && (
            <span className="font-mono text-ink-faint block" style={{ fontSize: 10, marginTop: 1 }}>
              /{story.slug}
            </span>
          )}
        </button>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center shrink-0" style={{ gap: 6 }}>

          {syncCount > 0 && (
            <div className="sync-badge">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              {!isMobile && <span className="text-xs font-light text-ink-soft">{syncCount} novas fotos</span>}
              <button className="bg-transparent border-none cursor-pointer text-ink-faint px-0.5 leading-none"
                      style={{ fontSize: 10 }} onClick={dismissSync} title="Dispensar">✕</button>
            </div>
          )}

          <button className="btn btn-secondary btn-sm" onClick={() => setShowImporter(true)} title="Importar álbum">
            {isMobile ? '↓' : '↓ Importar'}
          </button>

          <AiLayoutButton
            aiLayout={aiLayout}
            disabled={aiLayout.status === 'loading' || aiLayout.status === 'processing' || aiLayout.status === 'applying'}
            isMobile={isMobile}
          />

          {/* Icon buttons */}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowThemePicker(true)}
                  title="Tema" style={{ padding: '6px 9px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5"/>
              <circle cx="5.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/>
              <circle cx="10.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/>
              <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none"/>
            </svg>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordModal(true)}
                  title="Password" style={{ padding: '6px 9px' }}>
            <svg width="13" height="14" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.5" y="6.5" width="10" height="7.5" rx="2"/>
              <path d="M4 6.5V4.5a2.5 2.5 0 015 0v2"/>
            </svg>
          </button>

          <button className="btn btn-secondary btn-sm relative" onClick={() => setShowContribs(true)}
                  title="Contribuições" style={{ padding: '6px 9px' }}>
            <svg width="16" height="13" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="4.5" r="3"/>
              <path d="M1 13c0-3.3 2.7-5.5 6-5.5"/>
              <circle cx="13.5" cy="4.5" r="2.5"/>
              <path d="M11 13c0-2.5 1.6-4 4.5-4.5"/>
            </svg>
            {pendingContribs > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-accent text-white font-semibold rounded-full flex items-center justify-center px-0.5 leading-none"
                    style={{ fontSize: 9, minWidth: 13, height: 13 }}>
                {pendingContribs}
              </span>
            )}
          </button>

          {/* Divider */}
          <span className="w-px h-5 bg-paper-deep shrink-0" />

          {story.published && !isMobile && (
            <a href={`/${story.slug}`} target="_blank" rel="noreferrer"
               className="text-xs font-light text-ink-muted no-underline rounded-sm transition-all hover:bg-paper-warm hover:text-ink"
               style={{ padding: '5px 8px' }}>
              Ver ↗
            </a>
          )}

          {story.published ? (
            <>
              <span className="text-xs font-normal text-success px-2 py-1 bg-success-pale border border-success/20 rounded-xs tracking-wide">
                Publicado
              </span>
              <button className="btn btn-ghost btn-sm text-ink-muted" onClick={togglePublish} disabled={saving}>
                {saving ? '…' : 'Despublicar'}
              </button>
            </>
          ) : (
            <button className="btn btn-accent btn-sm" onClick={togglePublish} disabled={saving}>
              {saving ? '…' : 'Publicar'}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Mobile backdrop */}
        {isMobile && (leftOpen || rightOpen) && (
          <div
            className="fixed inset-0 z-[49] bg-black/35"
            onClick={() => { setLeftOpen(false); setRightOpen(false); }}
          />
        )}

        {/* ── Left sidebar — block list ── */}
        <aside
          className="bg-ink flex flex-col overflow-x-hidden shrink-0"
          style={isMobile ? {
            position: 'fixed', left: 0, top: 44, bottom: 52,
            width: 280, zIndex: 50,
            boxShadow: leftOpen ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
            transform: leftOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s ease',
          } : {
            width: leftOpen ? 192 : 40,
            transition: 'width 0.2s ease',
          }}
        >
          {leftOpen ? (
            <>
              {/* Sidebar header */}
              <div className="flex items-center justify-between shrink-0"
                   style={{ padding: '10px 12px 8px' }}>
                <span className="text-ink-faint/60 uppercase tracking-widest font-medium"
                      style={{ fontSize: 10 }}>
                  Blocos
                  <span className="ml-1.5 bg-white/8 text-ink-faint/50 rounded-full px-1.5 py-0.5"
                        style={{ fontSize: 9 }}>{blocks.length}</span>
                </span>
                <button
                  className="w-7 h-7 border-none bg-transparent text-ink-faint/50 cursor-pointer rounded-sm flex items-center justify-center shrink-0 transition-all hover:bg-white/5 hover:text-paper/70 p-0"
                  style={{ fontSize: 16 }}
                  onClick={() => setLeftOpen(false)} title="Fechar">‹</button>
              </div>
              <div className="flex-1 overflow-y-auto pb-3" style={{ padding: '4px 8px 12px' }}>
                <SortableBlockList
                  blocks={blocks}
                  selected={selected}
                  onSelect={selectBlock}
                  onReorder={handleReorder}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center" style={{ paddingTop: 8 }}>
              <button
                className="w-7 h-7 border-none bg-transparent text-ink-faint/50 cursor-pointer rounded-sm flex items-center justify-center shrink-0 transition-all hover:bg-white/5 hover:text-paper/70 p-0"
                style={{ fontSize: 16 }}
                onClick={() => setLeftOpen(true)} title="Mostrar blocos">›</button>
            </div>
          )}
        </aside>

        {/* ── Centre — preview canvas ── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--paper, #faf8f5)', paddingBottom: isMobile ? '4.5rem' : '6rem', ...themeVars }}
          onClick={() => setInsertMenuIdx(null)}
        >
          <div style={canvasStyle}>
            <BlockInsertZone afterIdx={-1} insertMenuIdx={insertMenuIdx} setInsertMenuIdx={setInsertMenuIdx} onAdd={addBlockAt} />
          </div>

          {blocks.length === 0 && (
            <div className="text-center pt-16 flex flex-col items-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" className="mb-4 opacity-60">
                <rect x="4" y="4" width="24" height="24" rx="4"/>
                <line x1="16" y1="11" x2="16" y2="21"/>
                <line x1="11" y1="16" x2="21" y2="16"/>
              </svg>
              <p className="font-display text-xl italic font-light text-ink-muted mb-1">Sem blocos ainda</p>
              <p className="text-sm font-light text-ink-faint">Usa o <strong>+</strong> acima para adicionar o primeiro</p>
            </div>
          )}

          {blocks.map((b, idx) => {
            const isHero = b.type === 'hero';
            const blockEl = (
              <div
                className="block-wrap"
                style={{
                  position: 'relative',
                  outline: selected === b.id ? '2px solid var(--mv-accent)' : '2px solid transparent',
                  outlineOffset: 2,
                  cursor: 'pointer',
                  transition: 'outline-color 0.1s',
                }}
                onClick={(e) => { e.stopPropagation(); selectBlock(b.id); }}
              >
                <BlockToolbar
                  onMoveUp={() => {
                    const i = blocks.findIndex((bl) => bl.id === b.id);
                    if (i > 0) handleReorder([...blocks.slice(0, i - 1), blocks[i], blocks[i - 1], ...blocks.slice(i + 1)]);
                  }}
                  onMoveDown={() => {
                    const i = blocks.findIndex((bl) => bl.id === b.id);
                    if (i < blocks.length - 1) handleReorder([...blocks.slice(0, i), blocks[i + 1], blocks[i], ...blocks.slice(i + 2)]);
                  }}
                  onDelete={() => deleteBlock(b.id)}
                />
                <ViewerBlock block={b} story={story} thumbUrlFn={editorThumbUrl} originalUrlFn={editorOriginalUrl} />
              </div>
            );
            return (
              <Fragment key={b.id}>
                {isHero ? blockEl : <div style={canvasStyle}>{blockEl}</div>}
                <div style={canvasStyle}>
                  <BlockInsertZone afterIdx={idx} insertMenuIdx={insertMenuIdx} setInsertMenuIdx={setInsertMenuIdx} onAdd={addBlockAt} />
                </div>
              </Fragment>
            );
          })}
        </main>

        {/* ── Right — properties panel ── */}
        <aside
          className="bg-paper border-l border-border overflow-y-auto overflow-x-hidden shrink-0"
          style={isMobile ? {
            position: 'fixed', left: 0, right: 0, bottom: 52,
            height: '65vh', width: '100%',
            borderTop: '1px solid var(--border)', borderLeft: 'none',
            borderRadius: '12px 12px 0 0',
            transform: rightOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s ease',
            zIndex: 50, overflowY: 'auto',
          } : {
            width: rightOpen ? 292 : 36,
            transition: 'width 0.2s ease',
          }}
        >
          {rightOpen ? (
            <>
              {/* Panel header */}
              <div className="flex items-center justify-between shrink-0 border-b border-border"
                   style={{ padding: '8px 12px 8px 14px' }}>
                <span className="text-ink-muted uppercase tracking-widest font-medium"
                      style={{ fontSize: 10 }}>
                  {selectedBlock ? selectedBlock.type : 'Propriedades'}
                </span>
                <button
                  className="w-7 h-7 border-none bg-transparent text-ink-faint cursor-pointer rounded-sm flex items-center justify-center shrink-0 transition-all hover:bg-paper-warm hover:text-ink p-0"
                  style={{ fontSize: 16 }}
                  onClick={() => setRightOpen(false)} title="Fechar painel">›</button>
              </div>

              {selectedBlock ? (
                <div style={{ padding: '16px 16px 24px' }}>
                  <BlockEditor
                    key={selectedBlock.id}
                    block={selectedBlock}
                    onChange={(content) => updateBlock(selectedBlock.id, content)}
                    storyId={id}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 64, paddingBottom: 40, padding: 24 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.7 }}>
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                  <p className="text-sm font-light text-ink-faint leading-relaxed">Selecciona um bloco<br/>para editar as propriedades</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center" style={{ paddingTop: 8 }}>
              <button
                className="w-7 h-7 border-none bg-transparent text-ink-faint cursor-pointer rounded-sm flex items-center justify-center shrink-0 transition-all hover:bg-paper-warm hover:text-ink p-0"
                style={{ fontSize: 16 }}
                onClick={() => setRightOpen(true)} title="Propriedades">‹</button>
            </div>
          )}
        </aside>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-paper border-t border-border flex z-[60]"
             style={{ height: 52 }}>
          <button
            className={`flex-1 h-full border-none cursor-pointer flex flex-col items-center justify-center transition-all ${leftOpen ? 'text-accent bg-accent-pale' : 'bg-transparent text-ink-muted'}`}
            style={{ gap: 3, fontSize: 10 }}
            onClick={() => { setLeftOpen((o) => !o); setRightOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span>Blocos</span>
          </button>
          <button
            className={`flex-1 h-full border-none cursor-pointer flex flex-col items-center justify-center transition-all ${rightOpen ? 'text-accent bg-accent-pale' : 'bg-transparent text-ink-muted'} ${!selectedBlock ? 'opacity-35' : ''}`}
            style={{ gap: 3, fontSize: 10 }}
            onClick={() => { if (selectedBlock) { setRightOpen((o) => !o); setLeftOpen(false); } }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            <span>Propriedades</span>
          </button>
        </nav>
      )}

      {showImporter && (
        <AlbumImporter storyId={id} onImported={handleImported} onClose={() => setShowImporter(false)} />
      )}

      {showPasswordModal && (
        <PasswordModal
          storyId={id}
          story={story}
          onClose={() => setShowPasswordModal(false)}
          onSaved={(updates) => setStory((s) => ({
            ...s,
            ...(updates.has_password !== undefined ? { password_hash: updates.has_password ? 'set' : null } : {}),
            ...(updates.contributions_enabled !== undefined ? { contributions_enabled: updates.contributions_enabled ? 1 : 0 } : {}),
          }))}
        />
      )}

      {showThemePicker && (
        <ThemePicker
          storyId={id}
          currentTheme={story.theme}
          onSaved={(theme) => setStory((s) => ({ ...s, theme }))}
          onClose={() => setShowThemePicker(false)}
        />
      )}

      {showSettings && (
        <StorySettingsModal
          storyId={id}
          story={story}
          onSaved={(updated) => setStory((s) => ({ ...s, ...updated }))}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showContribs && (
        <div className="fixed inset-0 bg-ink/45 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowContribs(false)}>
          <div
            className="bg-paper border border-border rounded-lg shadow-lg flex flex-col"
            style={{ width: 480, maxWidth: '95vw', height: '70vh', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0" style={{ marginBottom: 16 }}>
              <h3 className="font-display text-xl italic font-light text-ink">Contribuições</h3>
              <button className="bg-transparent border-none cursor-pointer text-ink-faint text-lg" onClick={() => setShowContribs(false)}>✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ContributionsPanel story={story} onPendingCount={(n) => setPendingContribs(n)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordModal({ storyId, story, onClose, onSaved }) {
  const hasPassword = !!story.password_hash;
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [contribEnabled, setContribEnabled] = useState(!!story.contributions_enabled);

  async function setPass(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/stories/${storyId}/password`, { password: password || null });
      setMsg(password ? 'Password definida.' : 'Password removida.');
      onSaved({ has_password: !!password, contributions_enabled: password ? contribEnabled : false });
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  }

  async function removePass() {
    setSaving(true);
    try {
      await api.post(`/api/stories/${storyId}/password`, { password: null });
      setMsg('Password removida.');
      onSaved({ has_password: false, contributions_enabled: false });
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  }

  async function toggleContribs(enabled) {
    setContribEnabled(enabled);
    try {
      await api.put(`/api/stories/${storyId}`, { contributions_enabled: enabled });
      onSaved({ contributions_enabled: enabled });
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao actualizar');
      setContribEnabled(!enabled);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/45 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-paper border border-border rounded-lg shadow-lg"
        style={{ width: 400, maxWidth: 'calc(100vw - 2rem)', padding: '2rem 2.5rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl italic font-light text-ink" style={{ marginBottom: 6 }}>Password da story</h3>
        <p className="text-sm font-light text-ink-muted" style={{ marginBottom: 20, lineHeight: 1.6 }}>
          Protege o acesso ao viewer público com uma password.
        </p>
        {msg ? (
          <p className="text-base font-light text-success bg-success-pale px-3.5 py-2.5 rounded-sm border border-success/25">{msg}</p>
        ) : (
          <form onSubmit={setPass} className="flex flex-col gap-3">
            <input
              className="field-input"
              type="password"
              placeholder={hasPassword ? 'Nova password (deixa vazio para manter)' : 'Definir password…'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end" style={{ marginTop: 4 }}>
              {hasPassword && <button type="button" className="btn btn-danger" onClick={removePass} disabled={saving}>Remover</button>}
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" type="submit" disabled={saving || !password}>Guardar</button>
            </div>
          </form>
        )}

        {hasPassword && (
          <div className="border-t border-border" style={{ marginTop: 20, paddingTop: 16 }}>
            <div className="flex items-start gap-3 cursor-pointer" onClick={() => toggleContribs(!contribEnabled)}>
              <div
                className="rounded-full relative shrink-0"
                style={{ width: 28, height: 16, marginTop: 2, background: contribEnabled ? 'var(--mv-accent)' : 'var(--border-strong)', transition: 'background 0.2s' }}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform"
                  style={{ left: 2, transform: contribEnabled ? 'translateX(12px)' : 'none' }}
                />
              </div>
              <div>
                <p className="text-base font-normal text-ink" style={{ margin: 0 }}>Permitir contribuições</p>
                <p className="text-sm font-light text-ink-muted" style={{ marginTop: 3, lineHeight: 1.5 }}>
                  Viewers desbloqueados podem enviar fotos e vídeos para revisão.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
