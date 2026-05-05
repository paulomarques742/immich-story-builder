import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';

const BrandIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={color} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="7" height="10" rx="0.5"/>
    <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
    <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
    <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
  </svg>
);

function PendingScreen({ onBack }) {
  return (
    <div className="min-h-screen bg-paper-warm flex items-center justify-center p-6">
      <div
        className="bg-paper border border-border rounded-lg"
        style={{ width: '100%', maxWidth: 400, padding: '2.5rem 2.5rem', boxShadow: '0 24px 64px rgba(26,24,20,0.12)' }}
      >
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
            <BrandIcon size={17} color="#faf8f5" />
          </div>
          <span className="font-display text-lg font-normal tracking-wide text-ink">Memoire</span>
        </div>
        <h1 className="font-display text-3xl italic font-light text-ink mb-2 leading-tight">Conta criada</h1>
        <p className="text-sm font-light text-ink-muted mb-8 leading-relaxed">
          A tua conta foi criada com sucesso. Aguarda que o administrador aprove o teu acesso — receberás uma notificação quando estiver pronto.
        </p>
        <button className="btn btn-secondary w-full justify-center" onClick={onBack}>
          ← Voltar ao login
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const h = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
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

  if (pending) return <PendingScreen onBack={() => { setPending(false); setIsRegister(false); }} />;

  /* ── Mobile: centered card ── */
  if (isMobile) {
    return (
      <div className="min-h-screen bg-paper-warm flex flex-col items-center justify-center p-6">
        <div
          className="bg-paper border border-border rounded-lg w-full"
          style={{ maxWidth: 400, padding: '2.5rem 2rem', boxShadow: '0 24px 64px rgba(26,24,20,0.12)' }}
        >
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <BrandIcon size={17} color="#faf8f5" />
            </div>
            <span className="font-display text-lg font-normal tracking-wide text-ink">Memoire</span>
          </div>

          <h1 className="font-display text-2xl italic font-light text-ink mb-1 leading-tight">
            {isRegister ? 'Criar conta' : 'Bem-vindo de volta'}
          </h1>
          <p className="text-sm font-light text-ink-muted mb-6">
            {isRegister ? 'Cria a tua conta local' : 'Entra na tua conta Memoire'}
          </p>

          <LoginForm
            form={form}
            set={set}
            isRegister={isRegister}
            error={error}
            loading={loading}
            onSubmit={handleSubmit}
            onToggle={() => { setIsRegister(!isRegister); setError(''); }}
          />
        </div>
      </div>
    );
  }

  /* ── Desktop: split panel ── */
  const INK = '#1a1814';
  const PAPER = '#faf8f5';
  const PAPER_WARM = '#f4f0ea';

  return (
    <div className="min-h-screen flex" style={{ background: PAPER_WARM }}>

      {/* Left — brand panel */}
      <div
        className="flex flex-col justify-between shrink-0"
        style={{ width: 400, background: INK, padding: '3rem 3.5rem' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <BrandIcon size={20} color={PAPER} />
          <span className="font-display text-xl font-normal tracking-wide" style={{ color: PAPER }}>Memoire</span>
        </div>

        {/* Tagline */}
        <div>
          <p className="font-display text-5xl italic font-light leading-tight" style={{ color: PAPER, marginBottom: '1.25rem' }}>
            As tuas<br/>histórias<br/>em imagens.
          </p>
          <p className="text-sm font-light leading-relaxed" style={{ color: 'rgba(250,248,245,0.55)' }}>
            Transforma os teus álbuns Immich em timelines narrativas elegantes, partilháveis com qualquer pessoa.
          </p>
        </div>

        {/* Decorative brand grid echo */}
        <div className="flex gap-1.5 items-end">
          <div style={{ width: 28, height: 40, borderRadius: 3, background: 'rgba(250,248,245,0.14)' }} />
          <div style={{ width: 28, height: 24, borderRadius: 3, background: 'rgba(250,248,245,0.10)' }} />
          <div style={{ width: 28, height: 32, borderRadius: 3, background: 'rgba(250,248,245,0.07)' }} />
          <div style={{ width: 28, height: 16, borderRadius: 3, background: 'rgba(250,248,245,0.04)' }} />
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center" style={{ padding: '3rem 2rem', background: PAPER_WARM }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          <h1 className="font-display text-4xl italic font-light text-ink mb-1.5 leading-tight">
            {isRegister ? 'Criar conta' : 'Bem-vindo de volta'}
          </h1>
          <p className="text-sm font-light text-ink-muted mb-8">
            {isRegister ? 'Preenche os dados para criar a tua conta local' : 'Entra na tua conta Memoire'}
          </p>

          <LoginForm
            form={form}
            set={set}
            isRegister={isRegister}
            error={error}
            loading={loading}
            onSubmit={handleSubmit}
            onToggle={() => { setIsRegister(!isRegister); setError(''); }}
          />
        </div>
      </div>
    </div>
  );
}

function LoginForm({ form, set, isRegister, error, loading, onSubmit, onToggle }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      {isRegister && (
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Nome</label>
          <input
            className="field-input"
            placeholder="O teu nome"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            autoFocus
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="field-label">Email</label>
        <input
          className="field-input"
          type="email"
          placeholder="nome@exemplo.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
          autoFocus={!isRegister}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="field-label">Password</label>
        <input
          className="field-input"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="text-sm font-light text-danger px-3 py-2 bg-danger/6 border border-danger/20 rounded-sm">
          {error}
        </p>
      )}

      <button className="btn btn-primary w-full justify-center" style={{ marginTop: 4 }} type="submit" disabled={loading}>
        {loading ? (isRegister ? 'A criar…' : 'A entrar…') : (isRegister ? 'Criar conta' : 'Entrar')}
      </button>

      <p className="text-center text-xs font-light text-ink-faint" style={{ marginTop: 8 }}>
        {isRegister ? 'Já tens conta? ' : 'Ainda não tens conta? '}
        <button
          type="button"
          className="text-ink-muted font-normal bg-transparent border-none cursor-pointer transition-colors hover:text-ink"
          onClick={onToggle}
        >
          {isRegister ? 'Entrar' : 'Criar conta'}
        </button>
      </p>
    </form>
  );
}
