import { useState, useEffect } from 'react';
import axios from 'axios';

export default function CommentSection({ slug, assetId, onClose }) {
  const [comments, setComments] = useState([]);
  const [form, setForm] = useState({ author_name: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/api/public/${slug}/comments/${assetId}`)
      .then((r) => setComments(r.data))
      .catch(() => {});
  }, [slug, assetId]);

  async function submit(e) {
    e.preventDefault();
    if (!form.author_name.trim() || !form.body.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await axios.post(`/api/public/${slug}/comments/${assetId}`, form);
      setComments((c) => [...c, r.data]);
      setForm({ author_name: '', body: '' });
    } catch {
      setError('Erro ao enviar comentário');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>Comentários</h3>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.list}>
          {comments.length === 0 && <p style={s.empty}>Sem comentários ainda. Sê o primeiro!</p>}
          {comments.map((c) => (
            <div key={c.id} style={s.comment}>
              <span style={s.author}>{c.author_name}</span>
              <p style={s.body}>{c.body}</p>
              <span style={s.date}>{new Date(c.created_at).toLocaleDateString('pt-PT')}</span>
            </div>
          ))}
        </div>

        <form onSubmit={submit} style={s.form}>
          {error && <p style={s.error}>{error}</p>}
          <input style={s.input} placeholder="O teu nome" value={form.author_name}
            onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))} required />
          <textarea style={{ ...s.input, height: 72, resize: 'vertical' }} placeholder="O teu comentário…"
            value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required />
          <button style={s.btnSubmit} type="submit" disabled={submitting}>
            {submitting ? 'A enviar…' : 'Comentar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', zIndex: 400 },
  panel: { width: 360, height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,.15)' },
  header: { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700 },
  close: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  list: { flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  empty: { color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 24 },
  comment: { borderBottom: '1px solid #f0f0f0', paddingBottom: 12 },
  author: { fontWeight: 600, fontSize: 13 },
  body: { fontSize: 14, marginTop: 4, lineHeight: 1.5, color: '#333' },
  date: { fontSize: 11, color: '#bbb', display: 'block', marginTop: 4 },
  form: { padding: '16px 20px', borderTop: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 },
  input: { padding: '8px 12px', border: '1px solid #ddd', borderRadius: 7, fontSize: 13, width: '100%' },
  btnSubmit: { padding: '9px 0', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, cursor: 'pointer' },
  error: { color: '#c0392b', fontSize: 12 },
};
