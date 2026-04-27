import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { thumbUrl } from '../../lib/immich.js';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const BubbleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Lightbox({ slug, photoRegistry, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex ?? 0);
  const [slideDir, setSlideDir] = useState(null); // 'left' | 'right' | null
  const [sliding, setSliding] = useState(false);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [form, setForm] = useState({ author_name: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const current = photoRegistry[index] || {};
  const { assetId, caption } = current;

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  // Load comments when photo changes
  useEffect(() => {
    if (!assetId) return;
    setComments([]);
    axios.get(`/api/public/${slug}/comments/${assetId}`)
      .then((r) => setComments(r.data))
      .catch(() => {});
  }, [slug, assetId]);

  const navigate = useCallback((dir) => {
    const next = index + dir;
    if (next < 0 || next >= photoRegistry.length) return;
    setSlideDir(dir > 0 ? 'right' : 'left');
    setSliding(true);
    setTimeout(() => {
      setIndex(next);
      setSlideDir(null);
      setSliding(false);
    }, 280);
  }, [index, photoRegistry.length]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === 'ArrowLeft') navigate(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 280);
  }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.author_name.trim()) errs.author_name = true;
    if (!form.body.trim()) errs.body = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const r = await axios.post(`/api/public/${slug}/comments/${assetId}`, form);
      setComments((c) => [...c, r.data]);
      setForm({ author_name: '', body: '' });
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }

  const imgStyle = {
    width: '100%',
    maxHeight: 'calc(100vh - 120px)',
    objectFit: 'contain',
    borderRadius: 4,
    boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
    transition: 'opacity 250ms, transform 300ms var(--ease-out)',
    opacity: sliding ? 0 : 1,
    transform: sliding
      ? `translateX(${slideDir === 'right' ? '-40px' : '40px'})`
      : 'translateX(0) scale(1)',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'stretch',
        background: 'rgba(12,10,8,0.96)',
        backdropFilter: 'blur(12px)',
        opacity: open ? 1 : 0,
        transition: 'opacity 280ms var(--ease)',
      }}
      onClick={handleClose}
    >
      {/* Photo side */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '3.5rem 2.5rem 2.5rem',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 200ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <CloseIcon />
        </button>

        {/* Prev button */}
        {index > 0 && (
          <button
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(4px)', color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          >
            <ChevronLeft />
          </button>
        )}

        {/* Image */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {assetId && (
            <img
              key={assetId}
              src={thumbUrl(assetId, 'preview')}
              alt={caption || ''}
              style={imgStyle}
            />
          )}
        </div>

        {caption && (
          <p style={{
            marginTop: '1rem', fontFamily: 'var(--font-body)',
            fontStyle: 'italic', fontWeight: 300, fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.35)', textAlign: 'center',
          }}>{caption}</p>
        )}

        {/* Next button */}
        {index < photoRegistry.length - 1 && (
          <button
            onClick={() => navigate(1)}
            style={{
              position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)',
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(4px)', color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          >
            <ChevronRight />
          </button>
        )}

        {/* Counter */}
        {photoRegistry.length > 1 && (
          <p style={{
            position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 300,
            color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em',
          }}>{index + 1} / {photoRegistry.length}</p>
        )}
      </div>

      {/* Comments side */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340, flexShrink: 0,
          background: 'var(--paper)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(20px)',
          transition: 'transform 380ms 60ms var(--ease-out)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem 1rem',
          borderBottom: '1px solid var(--paper-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 400, color: 'var(--ink)' }}>
            Comentários
          </span>
          {comments.length > 0 && (
            <span style={{
              background: 'var(--paper-deep)', borderRadius: 9999,
              padding: '2px 8px', fontFamily: 'var(--font-body)',
              fontSize: '0.72rem', fontWeight: 500, color: 'var(--ink-muted)',
            }}>{comments.length}</span>
          )}
        </div>

        {/* Scroll area */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}>
          {comments.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', color: 'var(--ink-muted)', paddingTop: '3rem',
            }}>
              <BubbleIcon />
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: '0.83rem',
                fontStyle: 'italic', color: 'var(--ink-muted)', textAlign: 'center', lineHeight: 1.6,
              }}>Ainda não há comentários.<br />Sê o primeiro!</p>
            </div>
          ) : (
            comments.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: 'flex', gap: '0.75rem',
                  animation: `fadeUp 300ms ${i * 50}ms both`,
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--paper-deep)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-body)', fontSize: '0.68rem',
                  fontWeight: 500, color: 'var(--ink-muted)',
                }}>
                  {initials(c.author_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 500, color: 'var(--ink)' }}>
                      {c.author_name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 300, color: 'var(--ink-faint)' }}>
                      {formatDate(c.created_at)}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: '0.83rem',
                    fontWeight: 300, lineHeight: 1.65, color: 'var(--ink-soft)',
                  }}>{c.body}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment form */}
        <form
          onSubmit={submit}
          style={{
            padding: '1rem 1.5rem 1.25rem',
            borderTop: '1px solid var(--paper-deep)',
            background: 'var(--paper-warm)',
            flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem',
          }}
        >
          <label style={{
            fontFamily: 'var(--font-body)', fontSize: '0.68rem',
            fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--ink-muted)',
          }}>Deixa um comentário</label>

          <input
            placeholder="O teu nome"
            value={form.author_name}
            onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
            style={{
              padding: '6px 10px', fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              background: 'var(--paper)', border: `1px solid ${errors.author_name ? 'var(--error, #b05050)' : 'var(--paper-deep)'}`,
              borderRadius: 4, outline: 'none', color: 'var(--ink)',
              transition: 'border-color 200ms',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26,24,20,0.06)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = errors.author_name ? 'var(--error,#b05050)' : 'var(--paper-deep)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <textarea
            placeholder="O teu comentário…"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={3}
            style={{
              padding: '6px 10px', fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              background: 'var(--paper)', border: `1px solid ${errors.body ? 'var(--error, #b05050)' : 'var(--paper-deep)'}`,
              borderRadius: 4, outline: 'none', resize: 'none', color: 'var(--ink)',
              lineHeight: 1.5, transition: 'border-color 200ms',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26,24,20,0.06)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = errors.body ? 'var(--error,#b05050)' : 'var(--paper-deep)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'var(--ink)', color: 'var(--paper)',
              border: 'none', borderRadius: 4,
              padding: '7px 14px', fontFamily: 'var(--font-body)',
              fontSize: '0.78rem', fontWeight: 400, cursor: 'pointer',
              opacity: submitting ? 0.6 : 1, transition: 'opacity 200ms, background 200ms',
              alignSelf: 'flex-end',
            }}
            onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = 'var(--ink-soft)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink)'; }}
          >
            {submitting ? 'A enviar…' : 'Publicar'}
          </button>
        </form>
      </div>
    </div>
  );
}
