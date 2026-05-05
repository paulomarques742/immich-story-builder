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
        className="insert-btn"
        style={iz.btn}
        onClick={() => setInsertMenuIdx(isOpen ? null : afterIdx)}
        title="Adicionar bloco"
      >
        +
      </button>
      {isOpen && (
        <div style={iz.menu}>
          {BLOCK_TYPES.map((t) => (
            <button
              key={t}
              style={iz.item}
              onClick={() => { onAdd(t, afterIdx); setInsertMenuIdx(null); }}
            >
              <span style={iz.icon}>{BLOCK_ICONS[t]}</span>
              <span style={{ textTransform: 'capitalize' }}>{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const iz = {
  btn: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '0.5px solid var(--border-strong)',
    background: 'var(--paper)',
    color: 'var(--ink-muted)',
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-xs)',
    zIndex: 5,
    position: 'relative',
  },
  menu: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 4,
    background: 'var(--paper)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
    minWidth: 160,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    padding: '9px 12px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 300,
    cursor: 'pointer',
    color: 'var(--ink-soft)',
    transition: 'background 0.1s',
  },
  icon: { fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 },
};

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

  // Load Google Fonts for the selected theme so fonts render in the preview
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

  const canvasStyle = isMobile ? { ...s.storyCanvas, padding: '0 1rem' } : s.storyCanvas;

  if (loading) return (
    <div style={s.loading}>
      <div className="spinner" style={{ marginBottom: 16 }} />
      <span style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-faint)' }}>A carregar editor…</span>
    </div>
  );
  if (!story) return <div style={s.loading}>Story não encontrada.</div>;

  return (
    <div style={s.shell}>
      {/* Top toolbar */}
      <header style={s.topbar}>
        <button className="btn btn-ghost" style={{ gap: 6, fontSize: 13 }} onClick={() => navigate('/dashboard')}>
          ← {!isMobile && 'Dashboard'}
        </button>
        <div style={s.topbarDivider} />
        <button style={s.storyTitleBtn} onClick={() => setShowSettings(true)} title="Editar definições da story">
          {story.title} <span style={{ opacity: 0.35, fontSize: 11, marginLeft: 4 }}>✏</span>
        </button>
        <div style={s.topbarRight}>
          {syncCount > 0 && (
            <div style={s.syncBadge}>
              <svg width="6" height="6" viewBox="0 0 6 6" fill="var(--mv-accent)" style={{ flexShrink: 0 }}>
                <circle cx="3" cy="3" r="3"/>
              </svg>
              {!isMobile && <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-soft)' }}>{syncCount} novas fotos</span>}
              <button style={s.syncDismiss} onClick={dismissSync} title="Dispensar">✕</button>
            </div>
          )}
          <button className="btn btn-secondary" onClick={() => setShowImporter(true)} title="Importar álbum">
            {isMobile ? '↓' : '↓ Importar álbum'}
          </button>
          <AiLayoutButton
            aiLayout={aiLayout}
            disabled={aiLayout.status === 'loading' || aiLayout.status === 'processing' || aiLayout.status === 'applying'}
            isMobile={isMobile}
          />
          <button
            className="btn btn-secondary"
            onClick={() => setShowThemePicker(true)}
            title="Tema da story"
            style={{ padding: '6px 9px' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5"/>
              <circle cx="5.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/>
              <circle cx="10.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/>
              <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowPasswordModal(true)}
            title="Password da story"
            style={{ padding: '6px 9px' }}
          >
            <svg width="13" height="14" viewBox="0 0 13 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.5" y="6.5" width="10" height="7.5" rx="2"/>
              <path d="M4 6.5V4.5a2.5 2.5 0 015 0v2"/>
            </svg>
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowContribs(true)}
            title="Contribuições de viewers"
            style={{ padding: '6px 9px', position: 'relative' }}
          >
            <svg width="16" height="13" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="4.5" r="3"/>
              <path d="M1 13c0-3.3 2.7-5.5 6-5.5"/>
              <circle cx="13.5" cy="4.5" r="2.5"/>
              <path d="M11 13c0-2.5 1.6-4 4.5-4.5"/>
            </svg>
            {pendingContribs > 0 && (
              <span style={{
                position: 'absolute', top: 1, right: 1,
                background: 'var(--mv-accent)', color: '#fff',
                borderRadius: 99, fontSize: 8, fontWeight: 600,
                minWidth: 13, height: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 2px', lineHeight: 1,
              }}>
                {pendingContribs}
              </span>
            )}
          </button>
          {story.published && !isMobile && (
            <a
              href={`/${story.slug}`}
              target="_blank"
              rel="noreferrer"
              style={s.viewLink}
            >
              Ver público ↗
            </a>
          )}
          {story.published ? (
            <>
              <span style={s.publishedBadge}>Publicado</span>
              <button className="btn btn-ghost" onClick={togglePublish} disabled={saving} style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                {saving ? '…' : 'Despublicar'}
              </button>
            </>
          ) : (
            <button className="btn btn-accent" onClick={togglePublish} disabled={saving}>
              {saving ? '…' : 'Publicar'}
            </button>
          )}
        </div>
      </header>

      <div style={s.body}>
        {/* Mobile backdrop */}
        {isMobile && (leftOpen || rightOpen) && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.35)' }}
            onClick={() => { setLeftOpen(false); setRightOpen(false); }}
          />
        )}

        {/* Left sidebar — collapsible on desktop, drawer on mobile */}
        <aside style={isMobile ? {
          ...s.sidebar,
          position: 'fixed', left: 0, top: 54, bottom: 52,
          width: 280, zIndex: 50,
          boxShadow: leftOpen ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
          transform: leftOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        } : { ...s.sidebar, width: leftOpen ? 192 : 40 }}>
          {leftOpen ? (
            <>
              <div style={s.sidebarHeader}>
                <span style={s.sidebarLabel}>
                  Blocos <span style={s.blockCount}>{blocks.length}</span>
                </span>
                <button style={s.panelToggle} onClick={() => setLeftOpen(false)} title="Fechar painel">‹</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
                <SortableBlockList
                  blocks={blocks}
                  selected={selected}
                  onSelect={selectBlock}
                  onReorder={handleReorder}
                />
              </div>
            </>
          ) : (
            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button style={s.panelToggle} onClick={() => setLeftOpen(true)} title="Mostrar blocos">›</button>
            </div>
          )}
        </aside>

        {/* Center — preview */}
        <main style={{ ...s.preview, ...themeVars, paddingBottom: isMobile ? '4.5rem' : '6rem' }} onClick={() => setInsertMenuIdx(null)}>
          {/* Insert zone before first block */}
          <div style={canvasStyle}>
            <BlockInsertZone
              afterIdx={-1}
              insertMenuIdx={insertMenuIdx}
              setInsertMenuIdx={setInsertMenuIdx}
              onAdd={addBlockAt}
            />
          </div>

          {blocks.length === 0 && (
            <div style={s.emptyPreview}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 14, opacity: 0.7 }}>
                <rect x="4" y="4" width="24" height="24" rx="4"/>
                <line x1="16" y1="11" x2="16" y2="21"/>
                <line x1="11" y1="16" x2="21" y2="16"/>
              </svg>
              <p style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-muted)', marginBottom: 4 }}>
                Sem blocos ainda
              </p>
              <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-faint)' }}>
                Usa o <strong>+</strong> acima para adicionar o primeiro
              </p>
            </div>
          )}

          {blocks.map((b, idx) => {
            const isHero = b.type === 'hero';
            const blockEl = (
              <div
                className="block-wrap"
                style={{
                  ...s.blockWrapper,
                  ...(selected === b.id ? s.blockWrapperActive : {}),
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
                  <BlockInsertZone
                    afterIdx={idx}
                    insertMenuIdx={insertMenuIdx}
                    setInsertMenuIdx={setInsertMenuIdx}
                    onAdd={addBlockAt}
                  />
                </div>
              </Fragment>
            );
          })}
        </main>

        {/* Right — properties, collapsible on desktop / bottom sheet on mobile */}
        <aside style={isMobile ? {
          ...s.props,
          position: 'fixed', left: 0, right: 0, bottom: 52,
          height: '65vh', width: '100%',
          borderTop: '1px solid var(--border)', borderLeft: 'none',
          borderRadius: '12px 12px 0 0',
          transform: rightOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          zIndex: 50, overflowY: 'auto',
        } : { ...s.props, width: rightOpen ? 292 : 36 }}>
          {rightOpen ? (
            <>
              <div style={s.propsHeader}>
                <button style={s.panelToggle} onClick={() => setRightOpen(false)} title="Fechar painel">›</button>
              </div>
              {selectedBlock ? (
                <div style={{ padding: '0 16px 24px' }}>
                  <BlockEditor
                    key={selectedBlock.id}
                    block={selectedBlock}
                    onChange={(content) => updateBlock(selectedBlock.id, content)}
                    storyId={id}
                  />
                </div>
              ) : (
                <div style={s.propsEmpty}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10, opacity: 0.8 }}>
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                  <p style={s.hint}>Selecciona um bloco para editar as propriedades</p>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button style={s.panelToggle} onClick={() => setRightOpen(true)} title="Propriedades">‹</button>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <nav style={s.mobileBar}>
          <button
            style={{ ...s.mobileBarBtn, ...(leftOpen ? s.mobileBarBtnActive : {}) }}
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
            style={{ ...s.mobileBarBtn, ...(rightOpen ? s.mobileBarBtnActive : {}), opacity: selectedBlock ? 1 : 0.35 }}
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
        <div style={s.overlay} onClick={() => setShowContribs(false)}>
          <div style={{ ...s.modal, width: 480, maxWidth: '95vw', height: '70vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--ink)' }}>Contribuições</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-faint)' }} onClick={() => setShowContribs(false)}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ContributionsPanel
                story={story}
                onPendingCount={(n) => setPendingContribs(n)}
              />
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
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>Password da story</h3>
        <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', marginBottom: 20 }}>
          Protege o acesso ao viewer público com uma password.
        </p>
        {msg ? (
          <p style={{ color: 'var(--success)', background: 'var(--success-pale)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 300 }}>{msg}</p>
        ) : (
          <form onSubmit={setPass} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="field"
              style={{ fontSize: 14, padding: '10px 13px' }}
              type="password"
              placeholder={hasPassword ? 'Nova password (deixa vazio para manter)' : 'Definir password…'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              {hasPassword && <button type="button" className="btn btn-danger" onClick={removePass} disabled={saving}>Remover</button>}
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" type="submit" disabled={saving || !password}>Guardar</button>
            </div>
          </form>
        )}

        {hasPassword && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }} onClick={() => toggleContribs(!contribEnabled)}>
              <div style={{ width: 28, height: 16, borderRadius: 8, background: contribEnabled ? 'var(--mv-accent)' : 'var(--border-strong)', position: 'relative', transition: 'background 0.15s', flexShrink: 0, marginTop: 2 }}>
                <div style={{ position: 'absolute', top: 2, left: 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transform: contribEnabled ? 'translateX(12px)' : 'none' }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink)', margin: 0 }}>Permitir contribuições</p>
                <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', margin: '2px 0 0' }}>
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

const s = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' },
  topbar: {
    height: 44,
    background: 'var(--paper)',
    borderBottom: '0.5px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px 0 16px',
    gap: 8,
    flexShrink: 0,
    zIndex: 10,
  },
  topbarDivider: { width: 1, height: 20, background: 'var(--paper-deep)', margin: '0 4px' },
  syncBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 8px 4px 10px',
    background: 'var(--paper-warm)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  },
  syncDismiss: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 10, color: 'var(--ink-faint)', padding: '0 2px', lineHeight: 1,
  },
  publishedBadge: {
    fontSize: 11, fontWeight: 400,
    color: 'var(--ink-muted)',
    padding: '4px 8px',
    background: 'var(--paper-warm)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    letterSpacing: '0.02em',
  },
  storyTitleBtn: {
    flex: 1, minWidth: 0,
    fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: 16,
    letterSpacing: '0.01em',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    color: 'var(--ink)', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', padding: '4px 6px',
    borderRadius: 'var(--radius-sm)', transition: 'background 0.12s',
  },
  topbarRight: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  viewLink: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-muted)',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background 0.12s, color 0.12s',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    background: 'var(--ink)',
    borderRight: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 10px 6px 12px',
    flexShrink: 0,
  },
  sidebarLabel: {
    fontSize: 9,
    color: 'rgba(184,178,168,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  blockCount: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(184,178,168,0.5)',
    padding: '1px 6px',
    borderRadius: 10,
    fontWeight: 400,
    fontSize: 10,
  },
  panelToggle: {
    width: 28,
    height: 28,
    border: 'none',
    background: 'none',
    color: 'rgba(184,178,168,0.5)',
    fontSize: 18,
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.12s, color 0.12s',
    padding: 0,
    lineHeight: 1,
  },
  preview: { flex: 1, overflowY: 'auto', background: 'var(--paper, #faf8f5)', paddingBottom: '6rem' },
  storyCanvas: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 2rem',
  },
  emptyPreview: {
    textAlign: 'center',
    color: 'var(--ink-muted)',
    paddingTop: 60,
    fontSize: 14,
    lineHeight: 1.6,
  },
  blockWrapper: {
    position: 'relative',
    outline: '2px solid transparent',
    outlineOffset: 2,
    cursor: 'pointer',
    transition: 'outline-color 0.1s',
  },
  blockWrapperActive: { outline: '2px solid var(--mv-accent)', outlineOffset: 2 },
  props: {
    background: 'var(--paper)',
    borderLeft: '0.5px solid var(--border)',
    overflowY: 'auto',
    overflowX: 'hidden',
    flexShrink: 0,
    transition: 'width 0.2s ease',
  },
  propsHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '6px 6px 0',
    marginBottom: 4,
    flexShrink: 0,
  },
  propsEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80%',
    paddingBottom: 40,
  },
  hint: { color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', lineHeight: 1.6 },
  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 15, color: 'var(--ink-muted)' },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,24,20,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 32px',
    width: 400,
    maxWidth: 'calc(100vw - 2rem)',
    boxShadow: '0 24px 64px rgba(26,24,20,0.16)',
    border: '0.5px solid var(--border)',
  },
  mobileBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: 52, background: 'var(--paper)',
    borderTop: '0.5px solid var(--border)',
    display: 'flex', zIndex: 60,
  },
  mobileBarBtn: {
    flex: 1, height: '100%', border: 'none',
    background: 'none', cursor: 'pointer',
    fontSize: 10, color: 'var(--ink-muted)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, transition: 'background 0.12s, color 0.12s',
  },
  mobileBarBtnActive: { color: 'var(--mv-accent)', background: 'var(--mv-accent-pale)' },
};
