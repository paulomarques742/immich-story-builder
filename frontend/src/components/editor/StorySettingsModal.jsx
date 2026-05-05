import { useState } from 'react';
import api from '../../lib/api.js';

function formatSlug(raw) {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const RESERVED = new Set(['api', 'login', 'dashboard', 'editor']);

function validateSlug(s) {
  if (!s || s.length < 2) return 'Slug demasiado curto (mín. 2 caracteres)';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) return 'Apenas letras minúsculas, números e hífens';
  if (RESERVED.has(s)) return 'Slug reservado — escolhe outro';
  return null;
}

export default function StorySettingsModal({ storyId, story, onSaved, onClose }) {
  const [form, setForm] = useState({
    title: story.title || '',
    description: story.description || '',
    slug: story.slug || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const slugChanged = form.slug !== story.slug;
  const slugError = validateSlug(form.slug);

  function handleSlugChange(e) {
    setForm((f) => ({ ...f, slug: formatSlug(e.target.value) }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('O título é obrigatório'); return; }
    if (slugError) { setError(slugError); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.put(`/api/stories/${storyId}`, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        slug: form.slug,
      });
      onSaved(res.data);
      onClose();
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Slug já em uso — escolhe outro');
      } else {
        setError('Erro ao guardar. Tenta novamente.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.heading}>Definições da story</h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={s.field}>
            <label style={s.label}>Título</label>
            <input
              className="field"
              style={s.input}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Título da story"
              autoFocus
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Descrição <span style={s.optional}>(opcional)</span></label>
            <textarea
              className="field"
              style={{ ...s.input, resize: 'vertical', minHeight: 72 }}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Breve descrição da story…"
              rows={3}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Slug (URL pública)</label>
            <input
              className="field"
              style={{ ...s.input, fontFamily: 'monospace', fontSize: 13 }}
              value={form.slug}
              onChange={handleSlugChange}
              placeholder="o-meu-slug"
              spellCheck={false}
            />
            <p style={s.urlPreview}>/{form.slug || '…'}</p>
            {slugChanged && !slugError && (
              <p style={s.warn}>⚠ O link público vai mudar — partilhas antigas deixam de funcionar</p>
            )}
          </div>

          {error && <p style={s.errorMsg}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving || !!slugError || !form.title.trim()}
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(26,24,20,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 32px',
    width: 440,
    maxWidth: 'calc(100vw - 2rem)',
    boxShadow: 'var(--shadow-lg)',
    border: '0.5px solid var(--border)',
  },
  heading: {
    fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500,
    color: 'var(--ink)', marginBottom: 20,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 500, color: 'var(--ink-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  optional: { fontWeight: 300, opacity: 0.6, textTransform: 'none', letterSpacing: 0 },
  input: { fontSize: 13, padding: '9px 12px' },
  urlPreview: {
    fontSize: 12, fontWeight: 300, color: 'var(--ink-faint)',
    fontFamily: 'monospace', marginTop: 2,
  },
  warn: {
    fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)',
    background: 'var(--paper-deep)', padding: '6px 10px',
    borderRadius: 'var(--radius-sm)', marginTop: 4,
    border: '0.5px solid var(--border)',
  },
  errorMsg: {
    fontSize: 13, fontWeight: 300, color: 'var(--danger)',
    background: 'rgba(176,80,80,0.06)', padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '0.5px solid rgba(176,80,80,0.2)',
  },
};
