import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { thumbUrl } from '../lib/immich.js';

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
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function Thumb({ assetId, className = '', style = {} }) {
  if (!assetId || assetId === '__story__') {
    return (
      <div className={`bg-paper-deep flex items-center justify-center ${className}`} style={style}>
        <BrandIcon size={24} color="var(--border-strong)" />
      </div>
    );
  }
  return (
    <img
      src={thumbUrl(assetId, 'thumbnail')}
      alt=""
      className={`object-cover bg-paper-deep ${className}`}
      style={style}
    />
  );
}

function groupByStory(assets) {
  const map = new Map();
  for (const a of assets) {
    if (!map.has(a.story_id)) {
      map.set(a.story_id, { story_id: a.story_id, story_title: a.story_title, story_slug: a.story_slug, assets: [] });
    }
    map.get(a.story_id).assets.push(a);
  }
  return [...map.values()];
}

export default function Social() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('feed');
  const [feed, setFeed] = useState([]);
  const [assets, setAssets] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    Promise.all([
      api.get('/api/social/feed').then((r) => setFeed(r.data)),
      api.get('/api/social/assets').then((r) => setAssets(r.data)),
      api.get('/api/social/ranking').then((r) => setRanking(r.data)),
      api.get('/api/notifications').then((r) => setNotifications(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  function goToPhoto(slug, assetId) {
    const params = assetId && assetId !== '__story__' ? `?photo=${assetId}` : '';
    window.open(`/${slug}${params}`, '_blank');
  }

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  const tabs = [
    { key: 'feed', label: 'Actividade' },
    { key: 'elements', label: 'Por elemento' },
    { key: 'ranking', label: 'Ranking' },
  ];

  const storyGroups = groupByStory(assets);

  const commentLookup = {};
  for (const a of assets) {
    commentLookup[`${a.story_slug}:${a.asset_id}`] = a.comment_count;
  }

  return (
    <div className="min-h-screen bg-paper-warm font-body">

      {/* Navbar */}
      <header className="bg-ink sticky top-0 z-10 h-navbar">
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 2rem' }} className="h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <BrandIcon size={22} color="#faf8f5" />
            <span className="font-display text-xl font-normal tracking-wide text-paper">Memoire</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-light text-ink-faint hidden sm:block">{user.email}</span>
            <button
              className="btn btn-ghost text-ink-faint hover:text-paper relative"
              title="Notificações"
              onClick={() => navigate('/dashboard')}
            >
              <BellIcon size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-accent text-white text-2xs font-medium rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>
            <button className="btn btn-ghost text-paper font-medium" onClick={() => navigate('/social')}>Social</button>
            <button className="btn btn-ghost text-ink-faint hover:text-paper" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="btn btn-ghost text-ink-faint hover:text-paper" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Page title */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 className="font-display text-5xl italic font-light text-ink leading-none tracking-tight">
            Actividade social
          </h1>
          <p className="text-sm font-light text-ink-faint mt-2">Comentários, gostos e engagement nas tuas stories</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6" style={{ marginBottom: '3rem' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-8 py-3 rounded-lg text-sm tracking-wide transition-all duration-150 ${
                tab === t.key
                  ? 'bg-ink-soft text-paper font-normal'
                  : 'text-ink-muted hover:text-ink font-light'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-paper border border-border rounded-lg px-6 py-5 flex gap-5 animate-pulse">
                <div className="w-16 h-16 rounded-lg bg-paper-deep shrink-0" />
                <div className="flex-1 flex flex-col gap-2.5 justify-center">
                  <div className="h-3 bg-paper-deep rounded w-1/4" />
                  <div className="h-4 bg-paper-deep rounded w-1/2" />
                  <div className="h-3 bg-paper-deep rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ACTIVIDADE tab ─────────────────────────────── */}
        {!loading && tab === 'feed' && (
          <div className="flex flex-col gap-4">
            {feed.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 bg-paper-deep rounded-lg flex items-center justify-center mb-5">
                  <BrandIcon size={28} color="var(--ink-faint)" />
                </div>
                <p className="text-sm font-light text-ink-muted">Ainda sem comentários nas tuas stories.</p>
              </div>
            )}
            {feed.map((item) => (
              <div
                key={item.id}
                className="group bg-paper border border-border rounded-lg px-6 py-5 flex gap-5 cursor-pointer
                           transition-all duration-150 hover:border-border-strong hover:shadow-sm"
                onClick={() => goToPhoto(item.story_slug, item.asset_id)}
              >
                {/* Thumbnail */}
                <Thumb
                  assetId={item.asset_id}
                  className="rounded-lg shrink-0"
                  style={{ width: 72, height: 72, minWidth: 72 }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Story pill */}
                  <span className="inline-block text-2xs font-normal text-accent bg-mv-accent-pale px-2 py-0.5 rounded-full mb-2 truncate max-w-[240px]">
                    {item.story_title}
                  </span>
                  {/* Author */}
                  <p className="text-sm font-medium text-ink leading-tight">{item.author_name}</p>
                  {/* Comment body */}
                  <p className="text-sm font-light text-ink-muted mt-1 leading-relaxed line-clamp-2">{item.body}</p>
                </div>

                {/* Right: date + arrow */}
                <div className="shrink-0 flex flex-col items-end justify-between">
                  <span className="text-2xs font-light text-ink-faint">{fmtDate(item.created_at)}</span>
                  <span className="text-xs font-light text-ink-faint group-hover:text-accent transition-colors">
                    Ver foto →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── POR ELEMENTO tab ───────────────────────────── */}
        {!loading && tab === 'elements' && (
          <div className="flex flex-col gap-12">
            {storyGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 bg-paper-deep rounded-lg flex items-center justify-center mb-5">
                  <BrandIcon size={28} color="var(--ink-faint)" />
                </div>
                <p className="text-sm font-light text-ink-muted">Nenhuma foto com actividade ainda.</p>
              </div>
            )}
            {storyGroups.map((group) => (
              <div key={group.story_id}>
                {/* Story header */}
                <div className="flex items-baseline gap-4 mb-6 pb-4 border-b border-border">
                  <h2 className="font-display text-2xl font-medium text-ink">{group.story_title}</h2>
                  <span className="text-xs font-light text-ink-faint font-mono">/{group.story_slug}</span>
                </div>

                {/* Photo grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 16 }}>
                  {group.assets.map((a) => (
                    <div
                      key={a.asset_id}
                      className="group cursor-pointer"
                      onClick={() => goToPhoto(a.story_slug, a.asset_id)}
                    >
                      {/* Photo */}
                      <div className="relative rounded-lg overflow-hidden aspect-square bg-paper-deep">
                        <Thumb
                          assetId={a.asset_id}
                          className="w-full h-full"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <span className="text-paper text-xs font-normal">Ver foto →</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 mt-3 px-1">
                        {a.like_count > 0 && (
                          <span className="text-xs font-light text-ink-muted flex items-center gap-1">
                            <span className="text-base leading-none">❤</span>
                            <span className="font-medium text-ink">{a.like_count}</span>
                          </span>
                        )}
                        {a.comment_count > 0 && (
                          <span className="text-xs font-light text-ink-muted flex items-center gap-1">
                            <span className="text-base leading-none">💬</span>
                            <span className="font-medium text-ink">{a.comment_count}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RANKING tab ────────────────────────────────── */}
        {!loading && tab === 'ranking' && (
          <div className="flex flex-col gap-4">
            {ranking.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 bg-paper-deep rounded-lg flex items-center justify-center mb-5">
                  <BrandIcon size={28} color="var(--ink-faint)" />
                </div>
                <p className="text-sm font-light text-ink-muted">Ainda sem gostos nas tuas stories.</p>
              </div>
            )}
            {ranking.map((item, idx) => {
              const comments = commentLookup[`${item.story_slug}:${item.asset_id}`] || 0;
              const isTop3 = idx < 3;
              return (
                <div
                  key={`${item.story_slug}:${item.asset_id}`}
                  className="group bg-paper border border-border rounded-lg px-5 py-4 flex items-center gap-5 cursor-pointer
                             transition-all duration-150 hover:border-border-strong hover:shadow-sm"
                  onClick={() => goToPhoto(item.story_slug, item.asset_id)}
                >
                  {/* Position */}
                  <div className={`shrink-0 w-8 text-center ${
                    idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-ink-faint'
                  }`}>
                    {isTop3
                      ? <span className="font-display text-2xl italic font-light leading-none">{['1º', '2º', '3º'][idx]}</span>
                      : <span className="text-sm font-light">#{idx + 1}</span>
                    }
                  </div>

                  {/* Thumbnail */}
                  <Thumb
                    assetId={item.asset_id}
                    className="rounded-lg shrink-0"
                    style={{ width: isTop3 ? 72 : 56, height: isTop3 ? 72 : 56, minWidth: isTop3 ? 72 : 56 }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-ink truncate ${isTop3 ? 'text-base' : 'text-sm'}`}>
                      {item.story_title}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1.5 text-sm font-light text-ink-muted">
                        <span>❤</span>
                        <span className="font-semibold text-ink">{item.like_count}</span>
                        <span className="text-xs">gostos</span>
                      </span>
                      {comments > 0 && (
                        <span className="flex items-center gap-1.5 text-sm font-light text-ink-muted">
                          <span>💬</span>
                          <span className="font-medium text-ink">{comments}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-light text-ink-faint group-hover:text-accent transition-colors">
                    Ver foto →
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
