import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import SortableBlockList from '../components/editor/SortableBlockList.jsx';
import BlockEditor from '../components/editor/BlockEditor.jsx';
import BlockToolbar from '../components/editor/BlockToolbar.jsx';
import AlbumImporter from '../components/editor/AlbumImporter.jsx';
import HeroBlock from '../components/blocks/HeroBlock.jsx';
import GridBlock from '../components/blocks/GridBlock.jsx';
import TextBlock from '../components/blocks/TextBlock.jsx';
import MapBlock from '../components/blocks/MapBlock.jsx';
import VideoBlock from '../components/blocks/VideoBlock.jsx';

const BLOCK_TYPES = ['hero', 'grid', 'text', 'map', 'video', 'divider'];

const BLOCK_ICONS = { hero: '🖼', grid: '▦', text: '¶', map: '📍', video: '▶', divider: '—' };

const DEFAULT_CONTENT = {
  hero:    { asset_id: '', caption: '', overlay: true, height: 'full' },
  grid:    { asset_ids: [], columns: 3, gap: 'sm', aspect: 'square' },
  text:    { markdown: '', align: 'left', max_width: 'prose' },
  map:     { mode: 'manual', lat: null, lng: null, zoom: 12, label: '' },
  video:   { asset_id: '', caption: '', autoplay: false, loop: false },
  divider: { style: 'line', label: '' },
};

function renderBlock(block) {
  const content = typeof block.content === 'string' ? JSON.parse(block.content) : block.content;
  if (block.type === 'hero') return <HeroBlock content={content} />;
  if (block.type === 'grid') return <GridBlock content={content} />;
  if (block.type === 'text') return <TextBlock content={content} />;
  if (block.type === 'map') return <MapBlock content={content} />;
  if (block.type === 'video') return <VideoBlock content={content} />;
  if (block.type === 'divider') {
    return (
      <div style={{ padding: '20px 24px', textAlign: 'center', color: 'var(--text-faint)' }}>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 8 }} />
        {content.label && <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{content.label}</span>}
      </div>
    );
  }
  return <div style={{ padding: 16, color: 'var(--text-faint)', fontSize: 13 }}>Bloco: {block.type}</div>;
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

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

  async function addBlock(type) {
    setShowTypeMenu(false);
    const res = await api.post(`/api/stories/${id}/blocks`, {
      type,
      content: DEFAULT_CONTENT[type] || {},
    });
    setBlocks((b) => [...b, res.data]);
    setSelected(res.data.id);
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

  const selectedBlock = blocks.find((b) => b.id === selected);

  if (loading) return <div style={s.loading}>A carregar editor…</div>;
  if (!story) return <div style={s.loading}>Story não encontrada.</div>;

  return (
    <div style={s.shell}>
      {/* Top toolbar */}
      <header style={s.topbar}>
        <button className="btn btn-ghost" style={{ gap: 6, fontSize: 13 }} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <div style={s.topbarDivider} />
        <span style={s.storyTitle}>{story.title}</span>
        <div style={s.topbarRight}>
          {syncCount > 0 && (
            <button className="btn btn-warn" onClick={dismissSync} title="Dispensar notificações de sync">
              📸 {syncCount} novas fotos  ✕
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowImporter(true)}>
            ↓ Importar álbum
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowPasswordModal(true)}
            title="Password da story"
            style={{ padding: '7px 10px' }}
          >
            🔒
          </button>
          {story.published && (
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
        {/* Left sidebar */}
        <aside style={s.sidebar}>
          <p style={s.sidebarLabel}>Blocos  <span style={s.blockCount}>{blocks.length}</span></p>

          <SortableBlockList
            blocks={blocks}
            selected={selected}
            onSelect={setSelected}
            onReorder={handleReorder}
          />

          <div style={{ position: 'relative', marginTop: 10 }}>
            <button style={s.btnAdd} onClick={() => setShowTypeMenu(!showTypeMenu)}>
              + Adicionar bloco
            </button>
            {showTypeMenu && (
              <div style={s.typeMenu}>
                {BLOCK_TYPES.map((t) => (
                  <button key={t} style={s.typeMenuItem} onClick={() => addBlock(t)}>
                    <span style={s.typeMenuIcon}>{BLOCK_ICONS[t]}</span>
                    <span style={{ textTransform: 'capitalize' }}>{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center — preview */}
        <main style={s.preview} onClick={() => setShowTypeMenu(false)}>
          {blocks.length === 0 && (
            <div style={s.emptyPreview}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
              <p style={{ fontWeight: 600, fontSize: 15 }}>Sem blocos ainda.</p>
              <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-muted)' }}>
                Usa "Importar álbum" ou "+ Adicionar bloco" para começar.
              </p>
            </div>
          )}
          {blocks.map((b) => (
            <div
              key={b.id}
              className="block-wrap"
              style={{
                ...s.blockWrapper,
                ...(selected === b.id ? s.blockWrapperActive : {}),
              }}
              onClick={(e) => { e.stopPropagation(); setSelected(b.id); }}
            >
              <BlockToolbar
                onMoveUp={() => {
                  const idx = blocks.findIndex((bl) => bl.id === b.id);
                  if (idx > 0) handleReorder([...blocks.slice(0, idx - 1), blocks[idx], blocks[idx - 1], ...blocks.slice(idx + 1)]);
                }}
                onMoveDown={() => {
                  const idx = blocks.findIndex((bl) => bl.id === b.id);
                  if (idx < blocks.length - 1) handleReorder([...blocks.slice(0, idx), blocks[idx + 1], blocks[idx], ...blocks.slice(idx + 2)]);
                }}
                onDelete={() => deleteBlock(b.id)}
              />
              {renderBlock(b)}
            </div>
          ))}
        </main>

        {/* Right — properties */}
        <aside style={s.props}>
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
        </aside>
      </div>

      {showImporter && (
        <AlbumImporter storyId={id} onImported={handleImported} onClose={() => setShowImporter(false)} />
      )}

      {showPasswordModal && (
        <PasswordModal
          storyId={id}
          hasPassword={!!story.password_hash}
          onClose={() => setShowPasswordModal(false)}
          onSaved={(has) => setStory((s) => ({ ...s, password_hash: has ? 'set' : null }))}
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
    width: 192,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarLabel: {
    fontSize: 10,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: 6,
    padding: '0 6px',
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
  btnAdd: {
    width: '100%',
    padding: '8px 0',
    background: 'transparent',
    border: '1px dashed var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background 0.12s, border-color 0.12s',
  },
  typeMenu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
  },
  typeMenuItem: {
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
  typeMenuIcon: { fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 },
  preview: { flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f5f5f4' },
  emptyPreview: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    paddingTop: 80,
    fontSize: 14,
    lineHeight: 1.6,
  },
  blockWrapper: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'border-color 0.1s',
    background: 'var(--surface)',
  },
  blockWrapperActive: { border: '2px solid var(--accent)', boxShadow: '0 0 0 3px rgba(17,24,39,0.08)' },
  props: {
    width: 292,
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    padding: 16,
    overflowY: 'auto',
    flexShrink: 0,
  },
  propsEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
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
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
  },
};
