import { useState, useEffect } from 'react';
import axios from 'axios';

const GLOBAL_ASSET_ID = '__story__';

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function GlobalComments({ slug }) {
  const [comments, setComments] = useState([]);
  const [form, setForm] = useState({ author_name: '', email: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(`/api/public/${slug}/comments/${GLOBAL_ASSET_ID}`)
      .then((r) => setComments(r.data))
      .catch(() => {});
  }, [slug]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.author_name.trim()) errs.author_name = true;
    if (!form.body.trim()) errs.body = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const r = await axios.post(`/api/public/${slug}/comments/${GLOBAL_ASSET_ID}`, {
        author_name: form.author_name,
        body: form.body,
      });
      setComments((c) => [...c, r.data]);
      setForm({ author_name: '', email: '', body: '' });
      setSubmitted(true);
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }

  const inputStyle = (hasError) => ({
    width: '100%', padding: '9px 12px',
    fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 300,
    background: 'var(--paper)', color: 'var(--ink)',
    border: `1px solid ${hasError ? '#b05050' : 'var(--paper-deep)'}`,
    borderRadius: 4, outline: 'none', transition: 'border-color 200ms, box-shadow 200ms',
  });

  return (
    <section style={{ marginTop: '4rem', paddingTop: '3rem', borderTop: '1px solid var(--paper-deep)' }}>
      {/* Heading */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400,
          color: 'var(--ink)', marginBottom: '0.4rem',
        }}>Comentários</h2>
        {comments.length > 0 && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 300,
            color: 'var(--ink-muted)',
          }}>{comments.length} comentário{comments.length !== 1 ? 's' : ''} nesta story</p>
        )}
      </div>

      {/* Comment list */}
      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginBottom: '3rem' }}>
          {comments.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'flex', gap: '1rem',
                animation: `fadeUp 400ms ${i * 60}ms both`,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--paper-deep)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-body)', fontSize: '0.75rem',
                fontWeight: 500, color: 'var(--ink-muted)',
              }}>
                {initials(c.author_name)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500, color: 'var(--ink)' }}>
                    {c.author_name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.725rem', fontWeight: 300, color: 'var(--ink-faint)' }}>
                    {formatDate(c.created_at)}
                  </span>
                </div>
                <p style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                  fontWeight: 300, lineHeight: 1.7, color: 'var(--ink-soft)',
                }}>{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment form */}
      <div style={{
        background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
        borderRadius: 8, padding: '1.75rem',
      }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 400,
          color: 'var(--ink)', marginBottom: '1.25rem',
        }}>Deixa um comentário</h3>

        {submitted ? (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 300,
            color: 'var(--ink-muted)', fontStyle: 'italic',
          }}>Obrigado pelo teu comentário! Ficará visível após aprovação.</p>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="mv-comment-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.7rem',
                  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em',
                  color: 'var(--ink-muted)', marginBottom: '0.4rem',
                }}>Nome</label>
                <input
                  value={form.author_name}
                  onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
                  placeholder="O teu nome"
                  style={inputStyle(errors.author_name)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26,24,20,0.06)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = errors.author_name ? '#b05050' : 'var(--paper-deep)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.7rem',
                  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em',
                  color: 'var(--ink-muted)', marginBottom: '0.4rem',
                }}>Email <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  style={inputStyle(false)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26,24,20,0.06)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--paper-deep)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.7rem',
                fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em',
                color: 'var(--ink-muted)', marginBottom: '0.4rem',
              }}>Comentário</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="O que pensas desta story…"
                rows={4}
                style={{ ...inputStyle(errors.body), resize: 'vertical', lineHeight: 1.6 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(26,24,20,0.06)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = errors.body ? '#b05050' : 'var(--paper-deep)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 300,
                color: 'var(--ink-faint)', lineHeight: 1.5,
              }}>O teu email não será publicado.<br />Os comentários são revistos antes de aparecerem.</p>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: 'var(--ink)', color: 'var(--paper)',
                  border: 'none', borderRadius: 4,
                  padding: '9px 20px', fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem', fontWeight: 400, cursor: 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  transition: 'background 200ms, transform 200ms, box-shadow 200ms, opacity 200ms',
                }}
                onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.background = 'var(--ink-soft)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(26,24,20,0.2)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {submitting ? 'A publicar…' : 'Publicar comentário'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
