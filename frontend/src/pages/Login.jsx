import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await api.post('/api/auth/register', { email: form.email, password: form.password, name: form.name });
        if (res.data.pending) { setPending(true); return; }
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

  if (pending) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.brand}>
            <div style={s.brandIcon}>M</div>
            <span style={s.brandName}>Memoire</span>
          </div>
          <h1 style={s.title}>Conta criada</h1>
          <p style={{ ...s.subtitle, marginBottom: 20 }}>
            A tua conta foi criada com sucesso. Aguarda que o administrador aprove o teu acesso.
          </p>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setPending(false); setIsRegister(false); }}>
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>
          <div style={s.brandIcon}>M</div>
          <span style={s.brandName}>Memoire</span>
        </div>

        <h1 style={s.title}>{isRegister ? 'Criar conta' : 'Bem-vindo de volta'}</h1>
        <p style={s.subtitle}>{isRegister ? 'Cria a tua conta local' : 'Entra na tua conta'}</p>

        <form onSubmit={handleSubmit} style={s.form}>
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

          {error && <p style={s.error}>{error}</p>}

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
            {loading ? 'A entrar…' : (isRegister ? 'Criar conta' : 'Entrar')}
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
