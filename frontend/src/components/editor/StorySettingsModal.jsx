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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(26,24,20,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-paper border border-border rounded-lg"
        style={{ width: 480, maxWidth: 'calc(100vw - 2rem)', padding: '1.75rem 2rem', boxShadow: '0 24px 64px rgba(26,24,20,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-display text-2xl italic font-light text-ink leading-none">Definições da story</h3>
            <p className="text-xs font-light text-ink-faint mt-1.5">Título, descrição e URL pública</p>
          </div>
          <button className="btn btn-ghost btn-sm text-ink-faint mt-0.5" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="field-label">Título</label>
            <input
              className="field-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Título da story"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="field-label">
              Descrição
              <span className="ml-1 font-light normal-case tracking-normal opacity-55">(opcional)</span>
            </label>
            <textarea
              className="field-textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Breve descrição da story…"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="field-label">URL pública (slug)</label>
            <input
              className="field-input font-mono"
              style={{ fontSize: 13 }}
              value={form.slug}
              onChange={handleSlugChange}
              placeholder="o-meu-slug"
              spellCheck={false}
            />
            <p className="text-xs font-light text-ink-faint font-mono">/{form.slug || '…'}</p>
            {slugChanged && !slugError && (
              <p className="text-xs font-light text-ink-muted bg-paper-deep px-2.5 py-1.5 rounded-sm border border-border">
                ⚠ O link público vai mudar — partilhas antigas deixam de funcionar
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm font-light text-danger bg-danger/6 px-3 py-2 rounded-sm border border-danger/20">{error}</p>
          )}

          <div className="flex gap-2 justify-end" style={{ marginTop: 4 }}>
            <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
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
