import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { publicThumbUrl } from '../lib/immich.js';

const BrandIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={color} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="7" height="10" rx="0.5"/>
    <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
    <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
    <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
  </svg>
);

function fmtDate(iso) {
  // SQLite devolve "YYYY-MM-DD HH:MM:SS" em UTC
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

function groupTokenKey(slug) {
  return `group_token_${slug}`;
}

export default function GroupPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  async function load() {
    try {
      const token = localStorage.getItem(groupTokenKey(slug));
      const r = await axios.get(`/api/g/${slug}`, { headers: token ? { 'x-group-token': token } : {} });
      setData(r.data);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
    }
  }

  useEffect(() => { load(); }, [slug]);

  useEffect(() => {
    if (data?.group) document.title = `${data.group.name} · Memoire`;
  }, [data]);

  async function unlock(e) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError('');
    try {
      const r = await axios.post(`/api/g/${slug}/unlock`, { password });
      if (r.data.token) localStorage.setItem(groupTokenKey(slug), r.data.token);
      await load();
    } catch (err) {
      setUnlockError(err.response?.data?.error || 'Password incorrecta');
    } finally {
      setUnlocking(false);
    }
  }

  function openStory(story) {
    // O grupo dá acesso às stories protegidas: o Viewer lê este token do sessionStorage
    if (story.access_token) sessionStorage.setItem(`story_token_${story.slug}`, story.access_token);
    navigate(`/${story.slug}`, { state: { fromGroup: { slug, name: data.group.name } } });
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-paper-warm font-body flex flex-col items-center justify-center gap-3 text-center px-6">
        <h1 className="font-display text-7xl font-light text-ink-faint">404</h1>
        <p className="text-base font-light text-ink-muted">Este grupo não existe.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-paper-warm font-body flex items-center justify-center text-sm text-ink-muted">
        A carregar…
      </div>
    );
  }

  const { group, stories, locked } = data;

  if (locked) {
    return (
      <div className="min-h-screen bg-paper-warm font-body flex items-center justify-center px-4">
        <div className="bg-paper border border-border rounded-lg shadow-lg text-center" style={{ width: 380, maxWidth: '100%', padding: '2.5rem 2rem' }}>
          <div className="w-12 h-12 bg-paper-deep rounded-lg flex items-center justify-center mx-auto mb-5">
            <BrandIcon size={24} color="var(--ink-faint)" />
          </div>
          <h1 className="font-display text-3xl italic font-light text-ink leading-tight">{group.name}</h1>
          <p className="text-sm font-light text-ink-muted mt-2 mb-6">Introduz a password para ver as stories.</p>
          <form onSubmit={unlock} className="flex flex-col gap-3">
            <input
              className="field-input text-center"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
            {unlockError && <p className="text-sm font-light text-danger">{unlockError}</p>}
            <button className="btn btn-primary" type="submit" disabled={unlocking}>
              {unlocking ? 'A verificar…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-warm font-body">
      <header className="bg-ink h-navbar">
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 1.25rem' }} className="h-full flex items-center gap-2.5">
          <BrandIcon size={22} color="#faf8f5" />
          <span className="font-display text-xl font-normal tracking-wide text-paper">Memoire</span>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem 1.25rem 4rem' }}>
        <div className="mb-8">
          <h1 className="font-display text-4xl italic font-light text-ink leading-tight tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="text-base font-light text-ink-muted mt-3 max-w-[560px] leading-relaxed whitespace-pre-line">{group.description}</p>
          )}
          {stories.length > 0 && (
            <p className="text-xs font-light text-ink-faint mt-3 tracking-wider">
              {stories.length} {stories.length === 1 ? 'story' : 'stories'}
            </p>
          )}
        </div>

        {stories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-paper-deep rounded-lg flex items-center justify-center mb-6">
              <BrandIcon size={28} color="var(--ink-faint)" />
            </div>
            <h2 className="font-display text-2xl italic font-light text-ink mb-2">Ainda sem stories</h2>
            <p className="text-sm font-light text-ink-muted max-w-[340px] leading-relaxed">
              Quando forem partilhadas novas stories com este grupo, aparecem aqui. Guarda este link.
            </p>
          </div>
        )}

        {stories.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
            {stories.map((story) => {
              const asset = story.cover_asset_id || story.hero_asset_id;
              return (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => openStory(story)}
                  className="group text-left bg-paper border border-border rounded-lg overflow-hidden cursor-pointer
                             transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-border-strong"
                >
                  <div className="relative aspect-[16/10] bg-paper-deep overflow-hidden">
                    {asset
                      ? <img
                          src={publicThumbUrl(story.slug, asset, 'preview')}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-[1.02]"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      : <div className="w-full h-full bg-gradient-to-br from-paper-warm to-paper-deep flex items-center justify-center">
                          <BrandIcon size={32} color="var(--border-strong)" />
                        </div>
                    }
                  </div>
                  <div style={{ padding: '1rem 1.25rem' }}>
                    <p className="font-display text-xl font-normal text-ink truncate">{story.title}</p>
                    {story.description && (
                      <p className="text-sm font-light text-ink-muted mt-1 line-clamp-2 leading-snug">{story.description}</p>
                    )}
                    <p className="text-2xs font-light text-ink-faint mt-2 uppercase tracking-wider">{fmtDate(story.created_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
