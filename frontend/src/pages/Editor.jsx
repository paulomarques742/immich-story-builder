import { useState, useEffect, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { thumbUrl, originalUrl } from '../lib/immich.js';
import SortableBlockList from '../components/editor/SortableBlockList.jsx';
import BlockEditor from '../components/editor/BlockEditor.jsx';
import BlockToolbar from '../components/editor/BlockToolbar.jsx';
import AlbumImporter from '../components/editor/AlbumImporter.jsx';
import AiLayoutButton from '../components/editor/AiLayoutButton.jsx';
import AiProgressModal from '../components/editor/AiProgressModal.jsx';
import ThemePicker from '../components/editor/ThemePicker.jsx';
import StorySettingsModal from '../components/editor/StorySettingsModal.jsx';
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
    border: '1.5px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
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
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
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
    cursor: 'pointer',
    color: 'var(--text)',
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
  const [showAiProgress, setShowAiProgress] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    ]).then(([sRes, bRes, syncRes]) => {
      setStory(sRes.data);
      setBlocks(bRes.data);
      setSyncCount(syncRes.data.new_asset_count || 0);
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

  if (loading) return <div style={s.loading}>A carregar editor…</div>;
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
            <button className="btn btn-warn" onClick={dismissSync} title="Dispensar notificações de sync">
              📸 {!isMobile && `${syncCount} novas fotos  `}✕
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowImporter(true)} title="Importar álbum">
            {isMobile ? '↓' : '↓ Importar álbum'}
          </button>
          {!isMobile && (
            <AiLayoutButton
              onTrigger={async (opts) => { await aiLayout.triggerAiLayout(opts); setShowAiProgress(true); }}
              disabled={aiLayout.status === 'loading' || aiLayout.status === 'processing'}
            />
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setShowThemePicker(true)}
            title="Tema da storie"
            style={{ padding: '7px 10px' }}
          >
            🎨
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowPasswordModal(true)}
            title="Password da story"
            style={{ padding: '7px 10px' }}
          >
            🔒
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
          <button
            className={`btn ${story.published ? 'btn-danger' : 'btn-primary'}`}
            onClick={togglePublish}
            disabled={saving}
          >
            {saving ? '…' : story.published ? 'Despublicar' : 'Publicar'}
          </button>
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
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>+</div>
              <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                Clica em <strong>+</strong> para adicionar o primeiro bloco
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
                <BlockEditor
                  key={selectedBlock.id}
                  block={selectedBlock}
                  onChange={(content) => updateBlock(selectedBlock.id, content)}
                />
              ) : (
                <div style={s.propsEmpty}>
                  <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.4 }}>⚙</div>
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
            <span style={{ fontSize: 18 }}>☰</span>
            <span>Blocos</span>
          </button>
          <button
            style={{ ...s.mobileBarBtn, ...(rightOpen ? s.mobileBarBtnActive : {}), opacity: selectedBlock ? 1 : 0.35 }}
            onClick={() => { if (selectedBlock) { setRightOpen((o) => !o); setLeftOpen(false); } }}
          >
            <span style={{ fontSize: 18 }}>⚙</span>
            <span>Propriedades</span>
          </button>
        </nav>
      )}

      {showImporter && (
        <AlbumImporter storyId={id} onImported={handleImported} onClose={() => setShowImporter(false)} />
      )}

      {showAiProgress && (
        <AiProgressModal
          status={aiLayout.status}
          progress={aiLayout.progress}
          processed={aiLayout.processed}
          total={aiLayout.total}
          blocksCreated={aiLayout.blocksCreated}
          error={aiLayout.error}
          onClose={() => { setShowAiProgress(false); aiLayout.reset(); }}
          onRetry={() => { aiLayout.reset(); setShowAiProgress(false); }}
        />
      )}

      {showPasswordModal && (
        <PasswordModal
          storyId={id}
          hasPassword={!!story.password_hash}
          onClose={() => setShowPasswordModal(false)}
          onSaved={(has) => setStory((s) => ({ ...s, password_hash: has ? 'set' : null }))}
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
    </div>
  );
}

function PasswordModal({ storyId, hasPassword, onClose, onSaved }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function setPass(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/stories/${storyId}/password`, { password: password || null });
      setMsg(password ? 'Password definida.' : 'Password removida.');
      onSaved(!!password);
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
      onSaved(false);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>Password da story</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Protege o acesso ao viewer público com uma password.
        </p>
        {msg ? (
          <p style={{ color: '#059669', background: '#f0fdf4', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>{msg}</p>
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
      </div>
    </div>
  );
}

const s = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' },
  topbar: {
    height: 54,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px 0 16px',
    gap: 8,
    flexShrink: 0,
  },
  topbarDivider: { width: 1, height: 20, background: 'var(--border)', margin: '0 4px' },
  storyTitle: {
    flex: 1,
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '-0.01em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text)',
  },
  storyTitleBtn: {
    flex: 1, minWidth: 0,
    fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    color: 'var(--text)', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left', padding: '4px 6px',
    borderRadius: 'var(--radius-sm)', transition: 'background 0.12s',
  },
  topbarRight: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  viewLink: {
    fontSize: 13,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background 0.12s, color 0.12s',
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
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
    fontSize: 10,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  blockCount: {
    background: '#f3f4f6',
    color: 'var(--text-muted)',
    padding: '1px 6px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 10,
  },
  panelToggle: {
    width: 28,
    height: 28,
    border: 'none',
    background: 'none',
    color: 'var(--text-faint)',
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
    color: 'var(--text-muted)',
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
  blockWrapperActive: { outline: '2px solid var(--accent)', outlineOffset: 2 },
  props: {
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
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
  hint: { color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', lineHeight: 1.6 },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 15, color: 'var(--text-muted)' },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 32px',
    width: 400,
    maxWidth: 'calc(100vw - 2rem)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
  },
  mobileBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: 52, background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex', zIndex: 60,
  },
  mobileBarBtn: {
    flex: 1, height: '100%', border: 'none',
    background: 'none', cursor: 'pointer',
    fontSize: 10, color: 'var(--text-muted)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, transition: 'background 0.12s, color 0.12s',
  },
  mobileBarBtnActive: { color: 'var(--accent)', background: 'var(--accent-soft, rgba(0,0,0,0.04))' },
};
