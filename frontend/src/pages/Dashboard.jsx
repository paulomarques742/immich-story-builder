import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { thumbUrl } from '../lib/immich.js';
import StorySettingsModal from '../components/editor/StorySettingsModal.jsx';

const BrandIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={color} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="7" height="10" rx="0.5"/>
    <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
    <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
    <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
  </svg>
);

const BellIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 2a6 6 0 0 0-6 6c0 3.5-1.5 5-1.5 5h15S16 11.5 16 8a6 6 0 0 0-6-6z"/>
    <path strokeLinecap="round" d="M11.73 17a2 2 0 0 1-3.46 0"/>
  </svg>
);

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingStory, setEditingStory] = useState(null);

  // Users panel
  const [users, setUsers] = useState([]);
  const [showUsers, setShowUsers] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    api.get('/api/stories').then((r) => setStories(r.data)).finally(() => setLoading(false));
    api.get('/api/notifications').then((r) => setNotifications(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user.role === 'admin') {
      api.get('/api/auth/admin/users').then((r) => setUsers(r.data)).catch(() => {});
    }
  }, []);

  const pendingCount = users.filter((u) => !u.approved).length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function approveUser(id) {
    await api.post(`/api/auth/admin/users/${id}/approve`);
    setUsers((list) => list.map((u) => u.id === id ? { ...u, approved: 1 } : u));
  }

  async function deleteUser(id) {
    if (!window.confirm('Eliminar este utilizador?')) return;
    await api.delete(`/api/auth/admin/users/${id}`);
    setUsers((list) => list.filter((u) => u.id !== id));
  }

  async function markAllRead() {
    await api.post('/api/notifications/read-all').catch(() => {});
    setNotifications((list) => list.map((n) => ({ ...n, read: 1 })));
  }

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
    <div className="min-h-screen bg-paper-warm font-body">

      {/* Navbar */}
      <header className="bg-ink sticky top-0 z-10 h-navbar">
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 2rem' }} className="h-full flex items-center justify-between">

          <div className="flex items-center gap-2.5">
            <BrandIcon size={22} color="#faf8f5" />
            <span className="font-display text-xl font-normal tracking-wide text-paper">Memoire</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-light text-ink-faint hidden sm:block">{user.email}</span>

            {/* Notification bell */}
            <button
              className="btn btn-ghost text-ink-faint hover:text-paper relative"
              title="Notificações"
              onClick={() => setShowNotifications((v) => !v)}
            >
              <BellIcon size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-accent text-white text-2xs font-medium rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>

            <button className="btn btn-ghost text-ink-faint hover:text-paper" onClick={() => navigate('/social')}>
              Social
            </button>
            {user.role === 'admin' && (
              <button className="btn btn-ghost text-ink-faint hover:text-paper relative" onClick={() => setShowUsers((v) => !v)}>
                Utilizadores
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-accent text-white text-2xs font-medium rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}

            <button className="btn btn-ghost text-ink-faint hover:text-paper" onClick={logout}>Sair</button>
            <button className="btn btn-accent" onClick={() => setShowModal(true)}>+ Nova Story</button>
          </div>

        </div>
      </header>

      {/* Page body */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Notifications panel */}
        {showNotifications && (
          <div className="bg-paper border border-border rounded-lg px-6 py-5 mb-8 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-xl font-medium text-ink">Notificações</h3>
              {unreadCount > 0 && (
                <button className="text-xs font-light text-ink-muted hover:text-ink transition-colors" onClick={markAllRead}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            {notifications.length === 0 && (
              <p className="text-xs font-light text-ink-muted">Sem notificações.</p>
            )}
            {notifications.map((n) => {
              const p = typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload;
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 pt-2.5 border-t border-border ${!n.read ? 'opacity-100' : 'opacity-60'}`}
                >
                  <div className="shrink-0 w-7 h-7 rounded-full bg-paper-deep flex items-center justify-center text-xs font-medium text-ink-muted uppercase select-none">
                    {(p.author_name || '?')[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-normal text-ink leading-snug">
                      <span className="font-medium">{p.author_name}</span> comentou em{' '}
                      <a
                        href={`/${p.story_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-accent transition-colors"
                        onClick={() => {
                          if (!n.read) markAllRead();
                        }}
                      >
                        {p.story_title}
                      </a>
                    </p>
                    <p className="text-xs font-light text-ink-muted mt-0.5 line-clamp-1">{p.body}</p>
                    <p className="text-2xs font-light text-ink-faint mt-0.5">{fmtDate(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-accent mt-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Users panel */}
        {showUsers && user.role === 'admin' && (
          <div className="bg-paper border border-border rounded-lg px-6 py-5 mb-8 flex flex-col gap-3">
            <h3 className="font-display text-xl font-medium text-ink mb-1">Utilizadores</h3>
            {users.length === 0 && (
              <p className="text-xs font-light text-ink-muted">Nenhum utilizador registado.</p>
            )}
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 pt-2.5 border-t border-border">
                <div className="min-w-0">
                  <p className="text-base font-normal text-ink flex items-center gap-1.5">
                    {u.name}
                    <span className={`text-2xs font-normal px-1.5 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-paper-deep text-ink-muted'}`}>
                      {u.role}
                    </span>
                  </p>
                  <p className="text-2xs font-light text-ink-muted mt-0.5">{u.email}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {!u.approved && (
                    <button className="btn btn-accent btn-sm" onClick={() => approveUser(u.id)}>Aprovar</button>
                  )}
                  {u.approved && <span className="text-xs font-light text-success px-2.5">Aprovado</span>}
                  {u.id !== user.id && (
                    <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id)}>Remover</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl italic font-light text-ink leading-none tracking-tight">
              As tuas stories
            </h1>
            {!loading && stories.length > 0 && (
              <p className="text-xs font-light text-ink-faint mt-2 tracking-wider">
                {stories.length} {stories.length === 1 ? 'story' : 'stories'}
              </p>
            )}
          </div>
        </div>

        {/* Skeleton loading */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-border animate-pulse">
                <div className="aspect-[16/10] bg-paper-deep" />
                <div className="px-4 py-3.5 flex flex-col gap-2.5">
                  <div className="h-4 bg-paper-deep rounded w-3/4" />
                  <div className="h-3 bg-paper-deep rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-14 h-14 bg-paper-deep rounded-lg flex items-center justify-center mb-7 shadow-xs">
              <BrandIcon size={28} color="var(--ink-faint)" />
            </div>
            <h2 className="font-display text-3xl italic font-light text-ink mb-2">Ainda sem stories</h2>
            <p className="text-sm font-light text-ink-muted max-w-[360px] leading-relaxed mb-7">
              Cria a tua primeira story e transforma os teus álbuns Immich em timelines narrativas.
            </p>
            <button className="btn btn-accent" onClick={() => setShowModal(true)}>Criar primeira story</button>
          </div>
        )}

        {/* Cards grid */}
        {!loading && stories.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {stories.map((story) => {
              const thumbAsset = story.cover_asset_id || story.hero_asset_id;
              return (
                <div
                  key={story.id}
                  className="group bg-paper border border-border rounded-lg overflow-hidden cursor-pointer
                             transition-all duration-200
                             hover:-translate-y-1 hover:shadow-lg hover:border-border-strong"
                  onClick={() => navigate(`/editor/${story.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[16/10] bg-paper-warm overflow-hidden">
                    {thumbAsset
                      ? <img
                          src={thumbUrl(thumbAsset, 'preview')}
                          alt=""
                          className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      : <div className="w-full h-full bg-gradient-to-br from-paper-warm to-paper-deep flex items-center justify-center">
                          <BrandIcon size={32} color="var(--border-strong)" />
                        </div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                      <span className={`badge ${story.published ? 'badge-published' : 'badge-draft'}`}>
                        {story.published ? 'Publicado' : 'Rascunho'}
                      </span>
                      {story.pending_sync > 0 && (
                        <span className="badge badge-new">{story.pending_sync} novas</span>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '1rem 1.25rem 1rem' }}>
                    <p className="font-display text-xl font-normal text-ink truncate" style={{ marginBottom: '0.5rem' }}>{story.title}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate min-w-0 font-mono" style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.01em' }}>/{story.slug}</span>
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          className="btn btn-icon btn-sm"
                          title="Definições da story"
                          onClick={(e) => { e.stopPropagation(); setEditingStory(story); }}
                        >⚙</button>
                        <button
                          className="btn btn-icon btn-sm"
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
        )}

      </main>

      {editingStory && (
        <StorySettingsModal
          storyId={editingStory.id}
          story={editingStory}
          onSaved={(updated) => setStories((list) => list.map((st) => st.id === updated.id ? { ...st, ...updated } : st))}
          onClose={() => setEditingStory(null)}
        />
      )}

      {/* New story modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-paper border border-border rounded-lg shadow-lg" style={{ width: 420, maxWidth: 'calc(100vw - 2rem)', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl italic font-light text-ink mb-1">Nova Story</h2>
            <p className="text-sm font-light text-ink-muted mt-1 mb-5">Dá um nome à tua story. Podes sempre mudar depois.</p>
            <form onSubmit={createStory} className="flex flex-col gap-3">
              <input
                className="field-input"
                placeholder="Ex: Viagem à Islândia 2024"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                required
              />
              <div className="flex gap-2 justify-end mt-1">
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
