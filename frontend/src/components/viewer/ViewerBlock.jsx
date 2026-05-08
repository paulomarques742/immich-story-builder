import ReactMarkdown from 'react-markdown';
import { publicThumbUrl, publicOriginalUrl } from '../../lib/immich.js';
import ViewerMapSkinned from './ViewerMapSkinned';
import { useState } from 'react';

// ── Like / comment overlay ────────────────────────────────────────
function PhotoStats({ assetId, likeCount = 0, commentCount = 0, liked = false, onLike }) {
  const [popping, setPopping] = useState(false);
  const hasStats = likeCount > 0 || commentCount > 0;

  function handleLike(e) {
    e.stopPropagation();
    setPopping(true);
    setTimeout(() => setPopping(false), 550);
    onLike?.(assetId);
  }

  return (
    <div className={`photo-stats${hasStats ? ' always-visible' : ''}`}>
      {commentCount > 0 && (
        <div className="photo-stat-pill">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount}
        </div>
      )}
      <button
        className={`photo-like-btn${liked ? ' liked' : ''}${popping ? ' popping' : ''}`}
        onClick={handleLike}
        title={liked ? 'Remover like' : 'Like'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {likeCount > 0 && <span>{likeCount}</span>}
      </button>
    </div>
  );
}

function parse(block) {
  try { return typeof block.content === 'string' ? JSON.parse(block.content) : block.content; }
  catch { return {}; }
}

// ── People filter ────────────────────────────────────────────────
function blockMatchesPeople(block, content, personAssetIds) {
  if (!personAssetIds || personAssetIds.size === 0) return true;
  if (block.type === 'grid') {
    return (content.asset_ids || []).some((id) => personAssetIds.has(id));
  }
  if (block.type === 'hero') {
    return content.asset_id ? personAssetIds.has(content.asset_id) : false;
  }
  return false;
}

// ── ViewerBlock dispatcher ───────────────────────────────────────
export default function ViewerBlock({ block, story, onPhotoOpen, photoRegistry, personAssetIds, thumbUrlFn = publicThumbUrl, originalUrlFn = null, likeCounts = {}, commentCounts = {}, likedByMe = {}, onLike, onMapViewChange, onMapPinChange }) {
  const content = parse(block);
  const matchedPeople = blockMatchesPeople(block, content, personAssetIds);
  const dimStyle = matchedPeople ? undefined : { display: 'none' };

  const slug = story?.slug;
  const photoProps = { likeCounts, commentCounts, likedByMe, onLike };

  switch (block.type) {
    case 'hero':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerHero content={content} story={story} slug={slug} thumbUrlFn={thumbUrlFn} /></div>;
    case 'divider':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerDivider content={content} /></div>;
    case 'text':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerText content={content} /></div>;
    case 'grid':
      return (
        <div id={`block-${block.id}`} style={dimStyle}>
          <ViewerGrid content={content} slug={slug} onPhotoOpen={onPhotoOpen} photoRegistry={photoRegistry} thumbUrlFn={thumbUrlFn} personAssetIds={personAssetIds} {...photoProps} />
        </div>
      );
    case 'map':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerMapSkinned content={content} onViewChange={onMapViewChange} onMapClick={onMapPinChange} /></div>;
    case 'video':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerVideo content={content} slug={slug} thumbUrlFn={thumbUrlFn} originalUrlFn={originalUrlFn} /></div>;
    case 'quote':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerQuote content={content} /></div>;
    case 'spacer':
      return <div id={`block-${block.id}`} style={dimStyle}><ViewerSpacer content={content} /></div>;
    default:
      return null;
  }
}

// ── Hero ─────────────────────────────────────────────────────────
function ViewerHero({ content, story, slug, thumbUrlFn = publicThumbUrl }) {
  const { asset_id, caption, eyebrow, height = 'full', title } = content;
  const h = height === 'full' ? '92vh' : height === 'half' ? '60vh' : '420px';
  // Se title estiver definido (mesmo vazio) usa-o; senão fallback para título da story (blocos antigos)
  const heroTitle = title !== undefined ? title : (story?.title || '');
  const heroEyebrow = eyebrow || '';
  const heroSub = caption && caption !== heroTitle ? caption : '';

  return (
    <div style={{ position: 'relative', height: h, minHeight: 560, overflow: 'hidden', background: 'var(--ink)' }}>
      {/* Background image */}
      {asset_id && (
        <img
          src={thumbUrlFn(slug, asset_id, 'preview')}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            animation: 'heroReveal 1.4s var(--ease-out) both',
          }}
        />
      )}

      {/* Grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.5,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: '200px 200px',
        pointerEvents: 'none',
      }} />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        background: 'linear-gradient(to top, rgba(26,24,20,0.72) 0%, rgba(26,24,20,0.18) 45%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div className="mv-hero-content" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '4rem 5rem', zIndex: 3,
        animation: 'fadeUp 1000ms 300ms var(--ease-out) both',
      }}>
        {heroEyebrow && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 500,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)', marginBottom: '0.75rem',
          }}>{heroEyebrow}</p>
        )}
        <h1 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
          fontSize: 'clamp(3rem, 7vw, 5.5rem)', lineHeight: 1.0,
          color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.2)',
          margin: 0,
        }}>{heroTitle}</h1>
        {heroSub && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 300,
            color: 'rgba(255,255,255,0.65)', marginTop: '1rem',
          }}>{heroSub}</p>
        )}
      </div>
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────
function ViewerDivider({ content }) {
  const { label } = content;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2rem',
      margin: '4rem 0 3rem',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--paper-deep)' }} />
      {label && (
        <span style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
          fontSize: '1.6rem', color: 'var(--ink-muted)',
          whiteSpace: 'nowrap',
        }}>{label}</span>
      )}
      <div style={{ flex: 1, height: 1, background: 'var(--paper-deep)' }} />
    </div>
  );
}

// ── Text ──────────────────────────────────────────────────────────
function ViewerText({ content }) {
  const { markdown = '', align = 'left' } = content;

  const components = {
    h2: ({ children }) => (
      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 2.8rem)',
        fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.01em',
        color: 'var(--ink)', marginBottom: '1rem',
      }}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2rem)',
        fontWeight: 400, lineHeight: 1.2, color: 'var(--ink)', marginBottom: '0.75rem',
      }}>{children}</h3>
    ),
    p: ({ children }) => (
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 300,
        lineHeight: 1.85, color: 'var(--ink-soft)', marginBottom: '1rem',
      }}>{children}</p>
    ),
    strong: ({ children }) => <strong style={{ fontWeight: 500, color: 'var(--ink)' }}>{children}</strong>,
    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
    a: ({ href, children }) => <a href={href} style={{ color: 'var(--mv-accent)', textDecoration: 'underline' }}>{children}</a>,
    blockquote: ({ children }) => (
      <blockquote style={{
        position: 'relative', maxWidth: 600, margin: '2rem auto', textAlign: 'center', padding: '1rem 2rem',
      }}>
        <span style={{
          position: 'absolute', top: '-1rem', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-display)', fontSize: '8rem', fontWeight: 300,
          color: 'var(--mv-accent-pale)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none',
          zIndex: 0,
        }}>"</span>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </blockquote>
    ),
  };

  return (
    <div style={{
      maxWidth: 640, margin: '0 auto',
      padding: '1rem 0', textAlign: align,
    }}>
      <ReactMarkdown components={components}>{markdown || ''}</ReactMarkdown>
    </div>
  );
}

// ── Grid (smart dispatch) ─────────────────────────────────────────
const GAP_MAP = { sm: '0.375rem', md: '0.75rem', lg: '1.5rem' };

function ViewerGrid({ content, slug, onPhotoOpen, photoRegistry, thumbUrlFn = publicThumbUrl, personAssetIds, likeCounts = {}, commentCounts = {}, likedByMe = {}, onLike }) {
  const { columns = 3, aspect = 'square', gap = 'sm' } = content;
  const asset_ids = personAssetIds?.size > 0
    ? (content.asset_ids || []).filter((id) => personAssetIds.has(id))
    : (content.asset_ids || []);
  const gapValue = GAP_MAP[gap] || GAP_MAP.sm;
  if (asset_ids.length === 0) return null;

  function openPhoto(assetId) {
    if (!onPhotoOpen) return;
    const idx = (photoRegistry || []).findIndex((p) => p.assetId === assetId);
    onPhotoOpen(idx >= 0 ? idx : 0);
  }

  const photoProps = { likeCounts, commentCounts, likedByMe, onLike };

  // Wrapper with overlay for grid items (non-full-width)
  function GridItem({ id, style, imgStyle, className }) {
    return (
      <div className={`photo-wrap${className ? ' ' + className : ''}`} style={{ ...style, cursor: 'zoom-in' }} onClick={() => openPhoto(id)}>
        <img src={thumbUrlFn(slug, id, 'preview')} alt="" className="mv-photo-img" style={imgStyle} />
        <PhotoStats assetId={id} likeCount={likeCounts[id] || 0} commentCount={commentCounts[id] || 0} liked={!!likedByMe[id]} onLike={onLike} />
      </div>
    );
  }

  // Single photo
  if (asset_ids.length === 1) {
    return <PhotoFull assetId={asset_ids[0]} slug={slug} caption={content.caption} onOpen={() => openPhoto(asset_ids[0])} thumbUrlFn={thumbUrlFn} {...photoProps} />;
  }

  // Single column
  if (columns === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: gapValue, margin: '2rem 0' }}>
        {asset_ids.map((id) => (
          <PhotoFull key={id} assetId={id} slug={slug} onOpen={() => openPhoto(id)} thumbUrlFn={thumbUrlFn} {...photoProps} />
        ))}
      </div>
    );
  }

  // Two columns + portrait or explicit duo layout → duo uniform grid
  const isDuo = content.layout === 'duo' || (columns === 2 && aspect === 'portrait' && content.layout !== 'asymmetric');
  if (columns === 2 && isDuo) {
    const duoAspect = aspect === 'landscape' ? '16/9' : aspect === 'square' ? '1/1' : '3/4';
    return (
      <div className="mv-photo-duo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gapValue, margin: '2rem 0' }}>
        {asset_ids.map((id) => (
          <GridItem key={id} id={id}
            style={{ borderRadius: 5, overflow: 'hidden', boxShadow: '0 1px 8px rgba(26,24,20,0.08)' }}
            imgStyle={{ aspectRatio: duoAspect, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            className="mv-photo-duo-item"
          />
        ))}
      </div>
    );
  }

  // Two columns → asymmetric magazine layout
  if (columns === 2) {
    const chunks = [];
    for (let i = 0; i < asset_ids.length; i += 3) chunks.push(asset_ids.slice(i, i + 3));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: gapValue, margin: '2rem 0' }}>
        {chunks.map((chunk, ci) => {
          if (chunk.length === 1) {
            return <PhotoFull key={chunk[0]} assetId={chunk[0]} slug={slug} onOpen={() => openPhoto(chunk[0])} thumbUrlFn={thumbUrlFn} {...photoProps} />;
          }
          if (chunk.length === 2) {
            return (
              <div key={chunk[0]} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gapValue }}>
                {chunk.map((id) => (
                  <GridItem key={id} id={id}
                    style={{ borderRadius: 5, overflow: 'hidden' }}
                    imgStyle={{ aspectRatio: '4/3', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ))}
              </div>
            );
          }
          const [a, b, c] = chunk;
          const bigLeft = ci % 2 === 0;
          const [main, s1, s2] = bigLeft ? [a, b, c] : [c, a, b];
          const cols = bigLeft ? '2fr 1fr' : '1fr 2fr';
          const mainEl = (
            <GridItem key={main} id={main}
              style={{ borderRadius: 5, overflow: 'hidden' }}
              imgStyle={{ minHeight: 240, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          );
          const stackEl = (
            <div key={s1} style={{ display: 'flex', flexDirection: 'column', gap: gapValue }}>
              {[s1, s2].map((id) => (
                <GridItem key={id} id={id}
                  style={{ flex: 1, borderRadius: 5, overflow: 'hidden' }}
                  imgStyle={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ))}
            </div>
          );
          return (
            <div key={chunk[0]} style={{ display: 'grid', gridTemplateColumns: cols, gap: gapValue }}>
              {bigLeft ? [mainEl, stackEl] : [stackEl, mainEl]}
            </div>
          );
        })}
      </div>
    );
  }

  // Default: uniform grid (3, 4 columns)
  const gridClass = columns === 3 ? 'mv-photo-grid-3' : columns === 4 ? 'mv-photo-grid-4' : '';
  const aspectRatio = aspect === 'landscape' ? '16/9' : aspect === 'portrait' ? '3/4' : '1/1';
  return (
    <div
      className={gridClass}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: gapValue, margin: '2rem 0' }}
    >
      {asset_ids.map((id) => (
        <GridItem key={id} id={id}
          style={{ borderRadius: 4, overflow: 'hidden' }}
          imgStyle={{ aspectRatio, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          className="mv-photo-grid-item"
        />
      ))}
    </div>
  );
}

// ── Photo Full-Width ──────────────────────────────────────────────
function PhotoFull({ assetId, slug, caption, onOpen, thumbUrlFn = publicThumbUrl, likeCounts = {}, commentCounts = {}, likedByMe = {}, onLike }) {
  return (
    <div
      className="mv-photo-full photo-wrap"
      style={{
        borderRadius: 6, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(26,24,20,0.10), 0 0 0 1px rgba(26,24,20,0.04)',
        cursor: 'zoom-in', margin: '2rem 0',
      }}
    >
      <div style={{ position: 'relative' }} onClick={onOpen}>
        <img
          src={thumbUrlFn(slug, assetId, 'preview')}
          alt={caption || ''}
          className="mv-photo-img"
          style={{ aspectRatio: '16/9', width: '100%', objectFit: 'cover', display: 'block' }}
        />
        <PhotoStats assetId={assetId} likeCount={likeCounts[assetId] || 0} commentCount={commentCounts[assetId] || 0} liked={!!likedByMe[assetId]} onLike={onLike} />
      </div>
      {caption && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--paper-deep)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontStyle: 'italic', fontWeight: 300,
            fontSize: '0.8rem', color: 'var(--ink-muted)',
          }}>{caption}</span>
        </div>
      )}
    </div>
  );
}

// ── Video ─────────────────────────────────────────────────────────
function ViewerVideo({ content, slug, thumbUrlFn = publicThumbUrl, originalUrlFn = null }) {
  const { asset_id, caption, autoplay = false, loop = false } = content;
  const [playing, setPlaying] = useState(false);
  const videoSrc = originalUrlFn ? originalUrlFn(slug, asset_id) : publicOriginalUrl(slug, asset_id);

  if (!asset_id) return null;

  if (playing) {
    return (
      <div style={{ borderRadius: 6, overflow: 'hidden', margin: '2rem 0', background: 'var(--ink)' }}>
        <video
          src={videoSrc}
          style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'contain' }}
          controls autoPlay={autoplay} loop={loop} playsInline
        />
        {caption && (
          <p style={{
            padding: '0.6rem 1rem', fontFamily: 'var(--font-body)', fontStyle: 'italic',
            fontWeight: 300, fontSize: '0.8rem', color: 'var(--ink-muted)',
            background: 'var(--paper-warm)', borderTop: '1px solid var(--paper-deep)',
          }}>{caption}</p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      style={{
        position: 'relative', aspectRatio: '16/9', borderRadius: 6,
        overflow: 'hidden', background: 'var(--ink)', cursor: 'pointer',
        margin: '2rem 0',
      }}
    >
      {/* Thumbnail */}
      <img
        src={thumbUrlFn(slug, asset_id, 'preview')}
        alt={caption || ''}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.75 }}
      />

      {/* Play group */}
      <div
        className="mv-video-play-group"
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
          transition: 'transform 300ms var(--ease-out)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {/* Play circle */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>

        {caption && (
          <span style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
            fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)',
          }}>{caption}</span>
        )}
      </div>
    </div>
  );
}

// ── Pull Quote ────────────────────────────────────────────────────
function ViewerQuote({ content }) {
  const { quote = '', author = '' } = content;
  if (!quote) return null;
  return (
    <div style={{
      maxWidth: 600, margin: '3rem auto', textAlign: 'center',
      padding: '2.5rem 2rem 1.5rem', position: 'relative',
    }}>
      <span style={{
        position: 'absolute', top: '-1rem', left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'var(--font-display)', fontSize: '8rem', fontWeight: 300,
        color: 'var(--mv-accent-pale)', lineHeight: 1,
        pointerEvents: 'none', userSelect: 'none', zIndex: 0,
      }}>"</span>
      <p style={{
        position: 'relative', zIndex: 1,
        fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300,
        fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', lineHeight: 1.4,
        color: 'var(--ink)', marginBottom: '1.5rem',
      }}>{quote}</p>
      {author && (
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 500,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)',
        }}>{author}</p>
      )}
    </div>
  );
}

// ── Spacer ────────────────────────────────────────────────────────
function ViewerSpacer({ content }) {
  const heights = { sm: 40, md: 80, lg: 140 };
  return <div style={{ height: heights[content.height || 'md'] || 80 }} />;
}
