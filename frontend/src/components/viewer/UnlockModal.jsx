import { useState } from 'react';
import axios from 'axios';

export default function UnlockModal({ slug, onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await axios.post(`/api/public/${slug}/unlock`, { password });
      sessionStorage.setItem(`story_token_${slug}`, r.data.token || '');
      onUnlock(r.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Password incorrecta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <p style={s.icon}>🔒</p>
        <h2 style={s.title}>Story protegida</h2>
        <p style={s.sub}>Introduz a password para continuar.</p>
        <form onSubmit={submit} style={s.form}>
          <input
            style={s.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          {error && <p style={s.error}>{error}</p>}
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'A verificar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 },
  card: { background: '#fff', borderRadius: 16, padding: '40px 36px', width: 340, boxShadow: '0 4px 32px rgba(0,0,0,.10)', textAlign: 'center' },
  icon: { fontSize: 36, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 14, color: '#888', marginBottom: 24 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, textAlign: 'center', letterSpacing: 2 },
  error: { color: '#c0392b', fontSize: 13 },
  btn: { padding: '11px 0', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
};
