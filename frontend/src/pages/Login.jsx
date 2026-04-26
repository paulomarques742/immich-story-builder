import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('local');
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
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>
          <div style={s.brandIcon}>M</div>
          <span style={s.brandName}>Memoire</span>
        </div>

        <h1 style={s.title}>
          {mode === 'immich' ? 'Entrar com Immich' : (isRegister ? 'Criar conta' : 'Bem-vindo de volta')}
        </h1>
        <p style={s.subtitle}>
          {mode === 'immich' ? 'Usa a tua API key do Immich' : (isRegister ? 'Cria a tua conta local' : 'Entra na tua conta')}
        </p>

        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(mode === 'local' ? s.tabActive : {}) }}
            onClick={() => setMode('local')}
          >
            Conta local
          </button>
          <button
            style={{ ...s.tab, ...(mode === 'immich' ? s.tabActive : {}) }}
            onClick={() => setMode('immich')}
          >
            Immich API Key
          </button>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          {mode === 'local' && (
            <>
              {isRegister && (
                <input
                  className="field"
                  style={s.inputOverride}
                  placeholder="Nome"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              )}
              <input
                className="field"
                style={s.inputOverride}
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                required
              />
              <input
                className="field"
                style={s.inputOverride}
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required
              />
              <button style={s.toggleLink} type="button" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? '← Já tenho conta' : 'Criar conta nova →'}
              </button>
            </>
          )}

          {mode === 'immich' && (
            <>
              <input
                className="field"
                style={s.inputOverride}
                placeholder="URL do Immich  (ex: https://immich.example.com)"
                value={form.immich_url}
                onChange={(e) => set('immich_url', e.target.value)}
                required
              />
              <input
                className="field"
                style={s.inputOverride}
                placeholder="API Key"
                value={form.api_key}
                onChange={(e) => set('api_key', e.target.value)}
                required
              />
            </>
          )}

          {error && <p style={s.error}>{error}</p>}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? 'A entrar…' : (mode === 'immich' ? 'Entrar com Immich' : (isRegister ? 'Criar conta' : 'Entrar'))}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  brandIcon: {
    width: 32,
    height: 32,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  brandName: { fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' },
  title: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    background: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: '7px 0',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s',
  },
  tabActive: {
    background: 'var(--surface)',
    color: 'var(--text)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  inputOverride: { fontSize: 14, padding: '10px 13px' },
  error: { color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: '#fef2f2', borderRadius: 'var(--radius-sm)' },
  toggleLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 13,
    textAlign: 'left',
    padding: '2px 0',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
  },
};
