import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { thumbUrl } from '../lib/immich.js';
import StorySettingsModal from '../components/editor/StorySettingsModal.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingStory, setEditingStory] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    api.get('/api/stories').then((r) => setStories(r.data)).finally(() => setLoading(false));
  }, []);

  async function createStory(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/stories', { title: newTitle.trim() });
      navigate(`/editor/${res.data.id}`);
    } finally {
      setCreating(false);
    }
  }

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoMark}>M</div>
          <span style={s.logoText}>Memoire</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userEmail}>{user.email}</span>
          <button className="btn btn-ghost" onClick={logout}>Sair</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nova Story</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.pageHeader}>
          <h2 style={s.pageTitle}>As tuas stories</h2>
          {!loading && stories.length > 0 && (
            <span style={s.storyCount}>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span>
          )}
        </div>

        {loading && (
          <div style={s.loadingRow}>
            {[1,2,3].map((i) => <div key={i} style={s.skeleton} />)}
          </div>
        )}

        {!loading && stories.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>📖</div>
            <p style={s.emptyTitle}>Ainda sem stories</p>
            <p style={s.emptyHint}>Cria a tua primeira story e transforma os teus álbuns Immich em timelines narrativas.</p>
            <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>Criar primeira story</button>
          </div>
        )}

        <div style={s.grid}>
          {stories.map((story) => {
            const thumbAsset = story.cover_asset_id || story.hero_asset_id;
            return (
              <div
                key={story.id}
                className="card"
                style={s.card}
                onClick={() => navigate(`/editor/${story.id}`)}
              >
                <div style={s.cardThumb}>
                  {thumbAsset
                    ? <img src={thumbUrl(thumbAsset, 'preview')} alt="" style={s.cardImg} />
                    : <div style={s.cardPlaceholder}><span style={s.placeholderIcon}>🌄</span></div>
                  }
                  <div style={s.cardBadge}>
                    <span style={{ ...s.badge, ...(story.published ? s.badgePublished : s.badgeDraft) }}>
                      {story.published ? 'Publicado' : 'Rascunho'}
                    </span>
                    {story.pending_sync > 0 && (
                      <span style={s.badgeSync}>{story.pending_sync} novas</span>
                    )}
                  </div>
                </div>
                <div style={s.cardBody}>
                  <p style={s.cardTitle}>{story.title}</p>
                  <div style={s.cardFooter}>
                    <p style={s.cardSlug}>/{story.slug}</p>
                    <button
                      style={s.settingsBtn}
                      title="Definições da story"
                      onClick={(e) => { e.stopPropagation(); setEditingStory(story); }}
                    >
                      ⚙
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {editingStory && (
        <StorySettingsModal
          storyId={editingStory.id}
          story={editingStory}
          onSaved={(updated) => setStories((list) => list.map((s) => s.id === updated.id ? { ...s, ...updated } : s))}
          onClose={() => setEditingStory(null)}
        />
      )}

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Nova Story</h2>
            <p style={s.modalHint}>Dá um nome à tua story. Podes sempre mudar depois.</p>
            <form onSubmit={createStory} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              <input
                className="field"
                style={{ fontSize: 14, padding: '10px 13px' }}
                placeholder="Ex: Viagem à Islândia 2024"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                required
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'A criar…' : 'Criar story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  header: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '0 32px',
    height: 58,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 28,
    height: 28,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
  },
  logoText: { fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' },
  headerRight: { display: 'flex', gap: 8, alignItems: 'center' },
  userEmail: { fontSize: 13, color: 'var(--text-muted)', marginRight: 4 },
  main: { maxWidth: 1120, margin: '0 auto', padding: '40px 32px' },
  pageHeader: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 28 },
  pageTitle: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' },
  storyCount: { fontSize: 13, color: 'var(--text-faint)', fontWeight: 500 },
  loadingRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 },
  skeleton: { height: 260, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' },
  emptyHint: { fontSize: 14, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.6, marginBottom: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 },
  card: {
    cursor: 'pointer',
    overflow: 'hidden',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow-xs)',
    transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
  },
  cardThumb: { height: 168, background: '#f3f4f6', position: 'relative', overflow: 'hidden' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' },
  cardPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)' },
  placeholderIcon: { fontSize: 28, opacity: 0.4 },
  cardBadge: { position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5 },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 },
  badgePublished: { background: 'rgba(16,185,129,0.12)', color: '#059669' },
  badgeDraft: { background: 'rgba(0,0,0,0.08)', color: '#6b7280' },
  badgeSync: { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: 'rgba(234,88,12,0.12)', color: '#ea580c' },
  cardBody: { padding: '14px 16px 16px' },
  cardTitle: { fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', marginBottom: 6, color: 'var(--text)' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardSlug: { fontSize: 12, color: 'var(--text-faint)', fontFamily: 'monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  settingsBtn: {
    flexShrink: 0,
    width: 28, height: 28,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)',
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
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
    width: 420,
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' },
  modalHint: { fontSize: 13, color: 'var(--text-muted)', marginTop: 4 },
};
