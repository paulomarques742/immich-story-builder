import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { thumbUrl } from '../lib/immich.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

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
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>Immich Story Builder</span>
        <div style={styles.headerRight}>
          <span style={styles.userEmail}>{user.email}</span>
          <button style={styles.btnSecondary} onClick={logout}>Sair</button>
          <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>+ Nova Story</button>
        </div>
      </header>

      <main style={styles.main}>
        {loading && <p style={styles.hint}>A carregar...</p>}
        {!loading && stories.length === 0 && (
          <div style={styles.empty}>
            <p>Ainda não tens nenhuma story.</p>
            <button style={styles.btnPrimary} onClick={() => setShowModal(true)}>Criar a primeira</button>
          </div>
        )}
        <div style={styles.grid}>
          {stories.map((s) => (
            <div key={s.id} style={styles.card} onClick={() => navigate(`/editor/${s.id}`)}>
              <div style={styles.cardThumb}>
                {s.cover_asset_id
                  ? <img src={thumbUrl(s.cover_asset_id)} alt="" style={styles.cardImg} />
                  : <div style={styles.cardPlaceholder} />}
              </div>
              <div style={styles.cardBody}>
                <p style={styles.cardTitle}>{s.title}</p>
                <p style={styles.cardMeta}>
                  {s.published ? '✓ Publicado' : '● Rascunho'} · /{s.slug}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 16 }}>Nova Story</h2>
            <form onSubmit={createStory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={styles.input} placeholder="Título" value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)} autoFocus required />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" style={styles.btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" style={styles.btnPrimary} disabled={creating}>
                  {creating ? 'A criar...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#fff', borderBottom: '1px solid #eee', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontWeight: 700, fontSize: 16 },
  headerRight: { display: 'flex', gap: 12, alignItems: 'center' },
  userEmail: { fontSize: 13, color: '#666' },
  main: { maxWidth: 1100, margin: '0 auto', padding: 32 },
  hint: { color: '#888', fontSize: 14 },
  empty: { textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 },
  card: { background: '#fff', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.06)', transition: 'box-shadow .15s' },
  cardThumb: { height: 160, background: '#e8e8e8' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardPlaceholder: { width: '100%', height: '100%', background: 'linear-gradient(135deg, #e0e0e0, #c8c8c8)' },
  cardBody: { padding: '12px 16px' },
  cardTitle: { fontWeight: 600, fontSize: 15 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  btnPrimary: { padding: '8px 18px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '8px 18px', background: '#fff', color: '#333', border: '1px solid #ddd', borderRadius: 7, fontSize: 14, cursor: 'pointer' },
  input: { padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 12, padding: 28, width: 360, boxShadow: '0 8px 40px rgba(0,0,0,.15)' },
};
