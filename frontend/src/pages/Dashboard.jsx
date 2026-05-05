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
  const [users, setUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    api.get('/api/stories').then((r) => setStories(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user.role === 'admin') {
      api.get('/api/auth/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    }
  }, []);

  async function approveUser(id) {
    await api.post(`/api/auth/admin/users/${id}/approve`);
    setUsers((list) => list.map((u) => u.id === id ? { ...u, approved: 1 } : u));
  }

  async function deleteUser(id) {
    if (!window.confirm('Eliminar este utilizador?')) return;
    await api.delete(`/api/auth/admin/users/${id}`);
    setUsers((list) => list.filter((u) => u.id !== id));
  }

  const pendingCount = users.filter((u) => !u.approved).length;

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

  async function deleteStory(e, id) {
    e.stopPropagation();
    if (!window.confirm('Tens a certeza que queres eliminar esta story? Esta ação é irreversível.')) return;
    await api.delete(`/api/stories/${id}`);
    setStories((list) => list.filter((st) => st.id !== id));
  }

  return (
    <div style={s.page}>
      <header style={s.header} className="dashboard-header">
        <div style={s.headerLeft}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="#faf8f5" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="7" height="10" rx="0.5"/>
            <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
            <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
            <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
          </svg>
          <span style={s.logoText}>Memoire</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.navLink}>{user.email}</span>
          {user.role === 'admin' && (
            <button style={{ ...s.navLink, cursor: 'pointer', background: 'none', border: 'none', position: 'relative' }} onClick={() => setShowUsers((v) => !v)}>
              Utilizadores
              {pendingCount > 0 && (
                <span style={s.navBadge}>{pendingCount}</span>
              )}
            </button>
          )}
          <button style={{ ...s.navLink, cursor: 'pointer', background: 'none', border: 'none' }} onClick={logout}>Sair</button>
          <button className="btn btn-accent" onClick={() => setShowModal(true)}>+ Nova Story</button>
        </div>
      </header>

      <main style={s.body} className="dashboard-body">
        {showUsers && user.role === 'admin' && (
          <div style={s.usersPanel}>
            <h3 style={s.usersPanelTitle}>Utilizadores</h3>
            {users.length === 0 && <p style={{ fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)' }}>Nenhum utilizador registado.</p>}
            {users.map((u) => (
              <div key={u.id} style={s.userRow}>
                <div style={{ minWidth: 0 }}>
                  <p style={s.userName}>
                    {u.name}
                    <span style={{ ...s.rolePill, ...(u.role === 'admin' ? s.roleAdmin : s.roleEditor) }}>{u.role}</span>
                  </p>
                  <p style={s.userEmail2}>{u.email}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!u.approved && (
                    <button className="btn btn-accent" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => approveUser(u.id)}>
                      Aprovar
                    </button>
                  )}
                  {u.approved && <span style={s.approvedBadge}>Aprovado</span>}
                  {u.id !== user.id && (
                    <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => deleteUser(u.id)}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={s.titleRow}>
          <h2 style={s.pageTitle}>As tuas stories</h2>
          {!loading && stories.length > 0 && (
            <span style={s.storyCount}>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span>
          )}
        </div>

        {loading && (
          <div style={s.grid} className="dashboard-grid">
            {[1,2,3].map((i) => <div key={i} style={s.skeleton} />)}
          </div>
        )}

        {!loading && stories.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="6" width="20" height="26" rx="3"/>
                <path d="M10 12h8M10 17h8M10 22h5"/>
                <path d="M26 14l6 6-6 6"/>
              </svg>
            </div>
            <p style={s.emptyTitle}>Ainda sem stories</p>
            <p style={s.emptyHint}>Cria a tua primeira story e transforma os teus álbuns Immich em timelines narrativas.</p>
            <button className="btn btn-accent btn-lg" onClick={() => setShowModal(true)}>Criar primeira story</button>
          </div>
        )}

        <div style={s.grid} className="dashboard-grid">
          {stories.map((story) => {
            const thumbAsset = story.cover_asset_id || story.hero_asset_id;
            return (
              <div
                key={story.id}
                style={s.card}
                onClick={() => navigate(`/editor/${story.id}`)}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,24,20,0.11)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(26,24,20,0.06)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={s.cardThumb}>
                  {thumbAsset
                    ? <img src={thumbUrl(thumbAsset, 'preview')} alt="" style={s.cardThumbImg} />
                    : <div style={s.cardThumbEmpty} />
                  }
                  <div style={s.cardBadge}>
                    <span style={{ ...s.badge, ...(story.published ? s.badgePublished : s.badgeDraft) }}>
                      {story.published ? 'Publicado' : 'Rascunho'}
                    </span>
                    {story.pending_sync > 0 && (
                      <span style={s.badgeNew}>{story.pending_sync} novas</span>
                    )}
                  </div>
                </div>
                <div style={s.cardBody}>
                  <p style={s.cardTitle}>{story.title}</p>
                  <div style={s.cardFooter}>
                    <p style={s.cardSlug} className="card-slug">/{story.slug}</p>
                    <div style={s.cardActions}>
                      <button
                        style={s.iconBtn}
                        title="Definições da story"
                        onClick={(e) => { e.stopPropagation(); setEditingStory(story); }}
                      >⚙</button>
                      <button
                        style={s.iconBtn}
                        title="Eliminar story"
                        onClick={(e) => deleteStory(e, story.id)}
                      >🗑</button>
                    </div>
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
          onSaved={(updated) => setStories((list) => list.map((st) => st.id === updated.id ? { ...st, ...updated } : st))}
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
  /* ── layout ── */
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-body)',
  },

  /* ── navbar ── */
  header: {
    background: 'var(--ink)',
    padding: '0 32px',
    height: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 400,
    letterSpacing: '0.02em',
    color: 'var(--paper)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  navLink: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-faint)',
    letterSpacing: '0.01em',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    background: 'var(--mv-accent)',
    color: '#fff',
    borderRadius: 99,
    fontSize: 9,
    fontWeight: 500,
    minWidth: 14,
    height: 14,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
  },

  /* ── page body ── */
  body: {
    padding: '36px 32px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 28,
  },
  pageTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--ink)',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  storyCount: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-muted)',
    letterSpacing: '0.04em',
  },

  /* ── users panel ── */
  usersPanel: {
    background: 'var(--paper)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    marginBottom: 32,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  usersPanelTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 },
  userRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 0',
    borderTop: '0.5px solid var(--border)',
  },
  userName: { fontSize: 13, fontWeight: 400, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 },
  userEmail2: { fontSize: 11, fontWeight: 300, color: 'var(--ink-muted)', marginTop: 2 },
  rolePill: { fontSize: 10, fontWeight: 400, padding: '2px 7px', borderRadius: 99 },
  roleAdmin: { background: 'rgba(99,102,241,0.1)', color: '#6366f1' },
  roleEditor: { background: 'var(--paper-deep)', color: 'var(--ink-muted)' },
  approvedBadge: { fontSize: 11, fontWeight: 300, color: 'var(--success)', padding: '4px 10px' },

  /* ── cards grid ── */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  skeleton: {
    height: 260,
    borderRadius: 'var(--radius)',
    background: 'linear-gradient(90deg,var(--paper-warm) 25%,var(--paper-deep) 50%,var(--paper-warm) 75%)',
    backgroundSize: '200% 100%',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 12, display: 'flex', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--ink)' },
  emptyHint: { fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', maxWidth: 380, lineHeight: 1.6, marginBottom: 8 },
  card: {
    background: 'var(--paper)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
    boxShadow: '0 1px 4px rgba(26,24,20,0.06)',
  },
  cardThumb: {
    height: 160,
    background: 'var(--paper-warm)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardThumbEmpty: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, var(--paper-warm), var(--paper-deep))',
  },
  cardThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },

  /* ── badges ── */
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    display: 'flex',
    gap: 5,
  },
  badge: {
    fontSize: 10,
    fontWeight: 400,
    fontFamily: 'var(--font-body)',
    padding: '2px 8px',
    borderRadius: 2,
    letterSpacing: '0.04em',
    lineHeight: 1.6,
  },
  badgePublished: {
    background: 'var(--success-pale)',
    color: 'var(--success)',
    border: '0.5px solid rgba(90,138,106,0.25)',
  },
  badgeDraft: {
    background: 'rgba(250,248,245,0.92)',
    color: 'var(--ink-muted)',
    border: '0.5px solid rgba(26,24,20,0.12)',
    backdropFilter: 'blur(4px)',
  },
  badgeNew: {
    background: 'var(--mv-accent-pale)',
    color: 'var(--mv-accent)',
    border: '0.5px solid rgba(196,121,90,0.25)',
    fontSize: 10,
    fontWeight: 400,
    fontFamily: 'var(--font-body)',
    padding: '2px 8px',
    borderRadius: 2,
    letterSpacing: '0.04em',
    lineHeight: 1.6,
  },

  /* ── card body ── */
  cardBody: {
    padding: '12px 14px 14px',
  },
  cardTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ink)',
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSlug: {
    fontSize: 11,
    fontWeight: 300,
    color: 'var(--ink-faint)',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  cardActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    width: 26,
    height: 26,
    border: '0.5px solid var(--border)',
    borderRadius: 3,
    background: 'var(--paper-warm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--ink-muted)',
    fontSize: 13,
    transition: 'background 0.12s, color 0.12s',
  },

  /* ── modal ── */
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,24,20,0.5)',
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
    width: 420,
    maxWidth: 'calc(100vw - 2rem)',
    boxShadow: 'var(--shadow-lg)',
    border: '0.5px solid var(--border)',
  },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 },
  modalHint: { fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', marginTop: 4 },
};
