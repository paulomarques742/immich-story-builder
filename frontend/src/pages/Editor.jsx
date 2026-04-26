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
      <div style={{ padding: '20px 24px', textAlign: 'center', color: '#aaa' }}>
        <hr style={{ border: 'none', borderTop: '1px solid #ddd', marginBottom: 8 }} />
        {content.label && <span style={{ fontSize: 13 }}>{content.label}</span>}
      </div>
    );
  }
  return <div style={{ padding: 16, color: '#aaa', fontSize: 13 }}>Bloco: {block.type}</div>;
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

  if (loading) return <div style={styles.loading}>A carregar editor...</div>;
  if (!story) return <div style={styles.loading}>Story não encontrada.</div>;

  return (
    <div style={styles.shell}>
      {/* Top toolbar */}
      <header style={styles.topbar}>
        <button style={styles.btnBack} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <span style={styles.storyTitle}>{story.title}</span>
        <div style={styles.topbarRight}>
          {syncCount > 0 && (
            <button style={styles.btnSync} onClick={dismissSync} title="Dispensar notificações de sync">
              📸 {syncCount} novas fotos ✕
            </button>
          )}
          <button style={styles.btnImport} onClick={() => setShowImporter(true)}>↓ Importar álbum</button>
          <button style={styles.btnSecondary} onClick={() => setShowPasswordModal(true)} title="Password da story">
            🔒
          </button>
          {story.published && (
            <a href={`/${story.slug}`} target="_blank" rel="noreferrer" style={styles.link}>Ver público ↗</a>
          )}
          <button style={story.published ? styles.btnDanger : styles.btnPrimary} onClick={togglePublish} disabled={saving}>
            {saving ? '...' : story.published ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </header>

      <div style={styles.body}>
        {/* Left sidebar — sortable block list */}
        <aside style={styles.sidebar}>
          <p style={styles.sidebarLabel}>Blocos ({blocks.length})</p>

          <SortableBlockList
            blocks={blocks}
            selected={selected}
            onSelect={setSelected}
            onReorder={handleReorder}
          />

          <div style={{ position: 'relative', marginTop: 8 }}>
            <button style={styles.btnAdd} onClick={() => setShowTypeMenu(!showTypeMenu)}>
              + Adicionar bloco
            </button>
            {showTypeMenu && (
              <div style={styles.typeMenu}>
                {BLOCK_TYPES.map((t) => (
                  <button key={t} style={styles.typeMenuItem} onClick={() => addBlock(t)}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center — preview */}
        <main style={styles.preview} onClick={() => setShowTypeMenu(false)}>
          {blocks.length === 0 && (
            <div style={styles.emptyPreview}>
              <p>Sem blocos ainda.</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Usa "Importar álbum" ou "+ Adicionar bloco"</p>
            </div>
          )}
          {blocks.map((b) => (
            <div
              key={b.id}
              style={{
                ...styles.blockWrapper,
                ...(selected === b.id ? styles.blockWrapperActive : {}),
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
        <aside style={styles.props}>
          {selectedBlock ? (
            <BlockEditor
              key={selectedBlock.id}
              block={selectedBlock}
              onChange={(content) => updateBlock(selectedBlock.id, content)}
            />
          ) : (
            <p style={styles.hint}>Selecciona um bloco para editar as propriedades</p>
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
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>🔒 Password da story</h3>
        {msg ? <p style={{ color: '#27ae60', textAlign: 'center' }}>{msg}</p> : (
          <form onSubmit={setPass} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={{ padding: '9px 12px', border: '1px solid #ddd', borderRadius: 7, fontSize: 14 }}
              type="password" placeholder={hasPassword ? 'Nova password (deixa vazio para manter)' : 'Definir password…'}
              value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {hasPassword && <button type="button" style={styles.btnDanger} onClick={removePass} disabled={saving}>Remover</button>}
              <button style={styles.btnSecondary} type="button" onClick={onClose}>Cancelar</button>
              <button style={styles.btnPrimary} type="submit" disabled={saving || !password}>Guardar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f0f0' },
  topbar: { height: 52, background: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 },
  btnBack: { background: 'none', border: 'none', color: '#555', fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  storyTitle: { flex: 1, fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  topbarRight: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  link: { fontSize: 13, color: '#555', textDecoration: 'none' },
  btnPrimary: { padding: '6px 14px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  btnDanger: { padding: '6px 14px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  btnImport: { padding: '6px 12px', background: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { padding: '6px 12px', background: '#fff', color: '#444', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  btnSync: { padding: '6px 12px', background: '#fff5e6', color: '#e67e22', border: '1px solid #f0c080', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 8px 40px rgba(0,0,0,.15)' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: 186, background: '#fff', borderRight: '1px solid #e0e0e0', padding: 10, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flexShrink: 0 },
  sidebarLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, padding: '0 4px' },
  btnAdd: { width: '100%', padding: '7px 0', background: '#f5f5f5', border: '1px dashed #ccc', borderRadius: 7, fontSize: 13, color: '#444', cursor: 'pointer' },
  typeMenu: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, zIndex: 50, marginTop: 4, overflow: 'hidden' },
  typeMenuItem: { display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer' },
  preview: { flex: 1, overflowY: 'auto', padding: 24 },
  emptyPreview: { textAlign: 'center', color: '#aaa', paddingTop: 80, fontSize: 14, lineHeight: 1.6 },
  blockWrapper: { position: 'relative', marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: '2px solid transparent', cursor: 'pointer' },
  blockWrapperActive: { border: '2px solid #1a1a1a' },
  props: { width: 300, background: '#fff', borderLeft: '1px solid #e0e0e0', padding: 16, overflowY: 'auto', flexShrink: 0 },
  hint: { color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 32 },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 15, color: '#888' },
};
