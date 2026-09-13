import { useState, useEffect } from 'react';
import api from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';

function formatSlug(raw) {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '');
}

function groupUrl(slug) {
  return `${window.location.origin}/g/${slug}`;
}

function GroupRow({ group, stories, expanded, onToggle, onChange, onDelete }) {
  const [form, setForm] = useState({ name: group.name, description: group.description || '', slug: group.slug });
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setForm({ name: group.name, description: group.description || '', slug: group.slug });
  }, [group.name, group.description, group.slug]);

  const slug = form.slug.replace(/-+$/, '');
  const dirty = form.name !== group.name || form.description !== (group.description || '') || slug !== group.slug;
  const memberIds = new Set(group.story_ids);
  const publishedCount = stories.filter((s) => memberIds.has(s.id) && s.published).length;

  function copyLink() {
    navigator.clipboard.writeText(groupUrl(group.slug)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function save() {
    if (!form.name.trim()) { setError('O nome é obrigatório'); return; }
    if (slug.length < 2) { setError('Link demasiado curto (mín. 2 caracteres)'); return; }
    setSaving(true);
    setError('');
    try {
      const r = await api.put(`/api/groups/${group.id}`, { name: form.name.trim(), description: form.description, slug });
      onChange(r.data);
    } catch (err) {
      setError(err.response?.status === 409 ? 'Esse link já está em uso — escolhe outro' : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStory(storyId) {
    const next = memberIds.has(storyId)
      ? group.story_ids.filter((id) => id !== storyId)
      : [...group.story_ids, storyId];
    onChange({ ...group, story_ids: next });
    try {
      const r = await api.put(`/api/groups/${group.id}/stories`, { story_ids: next });
      onChange(r.data);
    } catch {
      onChange(group);
      setError('Erro ao atualizar as stories do grupo');
    }
  }

  async function setGroupPassword(value) {
    setError('');
    try {
      const r = await api.post(`/api/groups/${group.id}/password`, { password: value });
      onChange({ ...group, has_password: r.data.has_password });
      setPassword('');
    } catch {
      setError('Erro ao alterar a password');
    }
  }

  return (
    <div className="pt-3 border-t border-border">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" className="min-w-0 text-left flex-1" onClick={onToggle}>
          <p className="text-base font-normal text-ink flex items-center gap-1.5">
            <span className="text-ink-faint text-xs w-3">{expanded ? '▾' : '▸'}</span>
            <span className="truncate">{group.name}</span>
            {group.has_password && <span title="Protegido com password" className="text-xs">🔒</span>}
          </p>
          <p className="text-2xs font-light text-ink-muted mt-0.5 font-mono truncate" style={{ marginLeft: 18 }}>
            /g/{group.slug} · {publishedCount} {publishedCount === 1 ? 'story visível' : 'stories visíveis'}
          </p>
        </button>
        <div className="flex gap-1.5 shrink-0">
          <button className="btn btn-secondary btn-sm" onClick={copyLink}>{copied ? 'Copiado!' : 'Copiar link'}</button>
          <a className="btn btn-ghost btn-sm" href={`/g/${group.slug}`} target="_blank" rel="noreferrer">Abrir ↗</a>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-5 pb-2" style={{ marginLeft: 18 }}>
          {/* Stories */}
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Stories neste grupo</label>
            {stories.length === 0 && <p className="text-xs font-light text-ink-muted">Ainda não tens stories.</p>}
            <div className="flex flex-col gap-1">
              {stories.map((story) => {
                const asset = story.cover_asset_id || story.hero_asset_id;
                return (
                  <label key={story.id} className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                    <input type="checkbox" checked={memberIds.has(story.id)} onChange={() => toggleStory(story.id)} />
                    <span className="w-9 h-6 rounded-sm overflow-hidden bg-paper-deep shrink-0">
                      {asset && <img src={thumbUrl(asset)} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <span className="text-sm font-light text-ink truncate">{story.title}</span>
                    {!story.published && (
                      <span className="badge badge-draft shrink-0" title="Só aparece no grupo depois de publicada">Rascunho</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Nome, descrição, link */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Nome</label>
              <input className="field-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">
                Descrição <span className="ml-1 font-light normal-case tracking-normal opacity-55">(opcional)</span>
              </label>
              <textarea className="field-textarea" rows={2} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">Link</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono text-ink-faint">/g/</span>
                <input className="field-input font-mono" style={{ fontSize: 13 }} spellCheck={false} value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: formatSlug(e.target.value) }))} />
              </div>
              {slug !== group.slug && (
                <p className="text-xs font-light text-ink-muted bg-paper-deep px-2.5 py-1.5 rounded-sm border border-border">
                  ⚠ O link do grupo vai mudar — quem tem o link antigo deixa de conseguir entrar
                </p>
              )}
            </div>
            {dirty && (
              <div className="flex justify-end">
                <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'A guardar…' : 'Guardar'}</button>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Password do grupo</label>
            <p className="text-xs font-light text-ink-muted">
              {group.has_password
                ? 'Quem abrir o link tem de introduzir a password (fica memorizada no dispositivo durante 30 dias).'
                : 'Sem password — qualquer pessoa com o link vê as stories do grupo.'}
            </p>
            <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (password) setGroupPassword(password); }}>
              <input className="field-input" type="password" placeholder={group.has_password ? 'Nova password' : 'Definir password'}
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <button className="btn btn-secondary btn-sm shrink-0" type="submit" disabled={!password}>
                {group.has_password ? 'Alterar' : 'Definir'}
              </button>
              {group.has_password && (
                <button className="btn btn-ghost btn-sm shrink-0" type="button" onClick={() => setGroupPassword(null)}>Remover</button>
              )}
            </form>
          </div>

          {error && <p className="text-sm font-light text-danger">{error}</p>}

          <div>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(group)}>Eliminar grupo</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupsPanel({ stories }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.get('/api/groups').then((r) => setGroups(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const r = await api.post('/api/groups', { name: newName.trim() });
      setGroups((list) => [...list, r.data].sort((a, b) => a.name.localeCompare(b.name, 'pt')));
      setExpandedId(r.data.id);
      setNewName('');
    } catch (err) {
      setError(err.response?.status === 409
        ? 'Já existe um grupo com esse link — usa outro nome'
        : err.response?.status === 400 ? 'Nome inválido para gerar um link' : 'Erro ao criar grupo');
    } finally {
      setCreating(false);
    }
  }

  async function deleteGroup(group) {
    if (!window.confirm(`Eliminar o grupo "${group.name}"? O link deixa de funcionar (as stories não são apagadas).`)) return;
    await api.delete(`/api/groups/${group.id}`);
    setGroups((list) => list.filter((g) => g.id !== group.id));
  }

  return (
    <div className="bg-paper border border-border rounded-lg px-6 py-5 mb-8 flex flex-col gap-3">
      <div>
        <h3 className="font-display text-xl font-medium text-ink">Grupos</h3>
        <p className="text-xs font-light text-ink-muted mt-1">
          Cada grupo tem um link fixo. Partilha-o uma vez — as stories que adicionares ao grupo vão aparecendo lá.
        </p>
      </div>

      <form onSubmit={createGroup} className="flex gap-2">
        <input className="field-input" placeholder="Nome do novo grupo (ex: Família)" value={newName}
          onChange={(e) => setNewName(e.target.value)} />
        <button className="btn btn-accent shrink-0" type="submit" disabled={creating || !newName.trim()}>
          {creating ? 'A criar…' : '+ Criar'}
        </button>
      </form>
      {error && <p className="text-sm font-light text-danger">{error}</p>}

      {loading && <p className="text-xs font-light text-ink-muted">A carregar…</p>}
      {!loading && groups.length === 0 && <p className="text-xs font-light text-ink-muted">Ainda não tens grupos.</p>}

      {groups.map((group) => (
        <GroupRow
          key={group.id}
          group={group}
          stories={stories}
          expanded={expandedId === group.id}
          onToggle={() => setExpandedId((id) => (id === group.id ? null : group.id))}
          onChange={(updated) => setGroups((list) => list.map((g) => (g.id === updated.id ? updated : g)))}
          onDelete={deleteGroup}
        />
      ))}
    </div>
  );
}
