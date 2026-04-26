import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('local'); // 'local' | 'immich'
  const [form, setForm] = useState({ email: '', password: '', name: '', immich_url: '', api_key: '' });
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (mode === 'immich') {
        res = await api.post('/api/auth/immich', { immich_url: form.immich_url, api_key: form.api_key });
      } else if (isRegister) {
        res = await api.post('/api/auth/register', { email: form.email, password: form.password, name: form.name });
      } else {
        res = await api.post('/api/auth/login', { email: form.email, password: form.password });
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro de autenticação');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Immich Story Builder</h1>

        <div style={styles.tabs}>
          <button style={mode === 'local' ? styles.tabActive : styles.tab} onClick={() => setMode('local')}>
            Conta local
          </button>
          <button style={mode === 'immich' ? styles.tabActive : styles.tab} onClick={() => setMode('immich')}>
            Immich API Key
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'local' && (
            <>
              {isRegister && (
                <input style={styles.input} placeholder="Nome" value={form.name}
                  onChange={(e) => set('name', e.target.value)} required />
              )}
              <input style={styles.input} type="email" placeholder="Email" value={form.email}
                onChange={(e) => set('email', e.target.value)} required />
              <input style={styles.input} type="password" placeholder="Password" value={form.password}
                onChange={(e) => set('password', e.target.value)} required />
              <button style={styles.toggleLink} type="button" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? 'Já tenho conta' : 'Criar conta nova'}
              </button>
            </>
          )}

          {mode === 'immich' && (
            <>
              <input style={styles.input} placeholder="URL do Immich (ex: https://immich.example.com)"
                value={form.immich_url} onChange={(e) => set('immich_url', e.target.value)} required />
              <input style={styles.input} placeholder="API Key"
                value={form.api_key} onChange={(e) => set('api_key', e.target.value)} required />
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'A entrar...' : (mode === 'immich' ? 'Entrar com Immich' : (isRegister ? 'Criar conta' : 'Entrar'))}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' },
  card: { background: '#fff', borderRadius: 12, padding: 40, width: 380, boxShadow: '0 4px 24px rgba(0,0,0,.08)' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 24, textAlign: 'center' },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: { flex: 1, padding: '8px 0', border: '1px solid #ddd', borderRadius: 8, background: '#f5f5f5', color: '#666' },
  tabActive: { flex: 1, padding: '8px 0', border: '1px solid #333', borderRadius: 8, background: '#1a1a1a', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
  btn: { padding: '11px 0', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600 },
  error: { color: '#c0392b', fontSize: 13 },
  toggleLink: { background: 'none', border: 'none', color: '#555', fontSize: 13, textAlign: 'left', padding: 0 },
};
