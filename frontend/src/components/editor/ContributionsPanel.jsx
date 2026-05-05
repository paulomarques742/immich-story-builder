import { useState, useEffect, useCallback } from 'react';
import { listContributions, updateContribution, deleteContribution } from '../../lib/api.js';
import { thumbUrl } from '../../lib/immich.js';

const TABS = [
  { key: 'pending', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovadas' },
  { key: 'rejected', label: 'Rejeitadas' },
];

export default function ContributionsPanel({ story, onPendingCount }) {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listContributions(story.id, tab);
      setRows(r.data);
      if (tab === 'pending') onPendingCount?.(r.data.length);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [story.id, tab]);

  useEffect(() => { load(); }, [load]);

  async function act(id, status) {
    try {
      await updateContribution(story.id, id, status);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao actualizar');
    }
  }

  async function remove(id) {
    if (!confirm('Eliminar esta contribuição?')) return;
    try {
      await deleteContribution(story.id, id);
      load();
    } catch { /* ignore */ }
  }

  if (!story.contributions_enabled) {
    return (
      <div style={s.empty}>
        <p style={s.emptyText}>As contribuições não estão activas nesta story.</p>
        <p style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Activa-as nas definições (requer password).</p>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p style={s.hint}>A carregar…</p>}
      {!loading && rows.length === 0 && <p style={s.hint}>Nenhum ficheiro {tab}.</p>}

      <div style={s.list}>
        {rows.map((c) => (
          <div key={c.id} style={s.card}>
            {c.immich_asset_id && (
              <img
                src={thumbUrl(c.immich_asset_id)}
                alt={c.original_name}
                style={s.thumb}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div style={s.info}>
              <p style={s.name} title={c.original_name}>{c.original_name}</p>
              {c.uploader_name && <p style={s.uploader}>por {c.uploader_name}</p>}
              <p style={s.date}>{new Date(c.uploaded_at).toLocaleString('pt-PT')}</p>
            </div>
            <div style={s.actions}>
              {tab === 'pending' && (
                <>
                  <button style={{ ...s.btn, ...s.btnApprove }} onClick={() => act(c.id, 'approved')}>✓</button>
                  <button style={{ ...s.btn, ...s.btnReject }} onClick={() => act(c.id, 'rejected')}>✕</button>
                </>
              )}
              {tab === 'rejected' && (
                <button style={{ ...s.btn, ...s.btnApprove }} onClick={() => act(c.id, 'approved')}>✓</button>
              )}
              {tab === 'approved' && (
                <button style={{ ...s.btn, ...s.btnReject }} onClick={() => act(c.id, 'rejected')}>✕</button>
              )}
              <button style={{ ...s.btn, ...s.btnDelete }} onClick={() => remove(c.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%' },
  tabs: { display: 'flex', borderBottom: '1px solid #eee', marginBottom: 12 },
  tab: { flex: 1, padding: '8px 0', background: 'none', border: 'none', fontSize: 13, color: '#888', cursor: 'pointer', borderBottom: '2px solid transparent' },
  tabActive: { color: '#1a1a1a', borderBottom: '2px solid #1a1a1a', fontWeight: 600 },
  hint: { fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 24 },
  empty: { padding: 24, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#666' },
  list: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  card: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' },
  thumb: { width: 52, height: 52, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#eee' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 },
  uploader: { fontSize: 11, color: '#888' },
  date: { fontSize: 11, color: '#aaa' },
  actions: { display: 'flex', gap: 4, flexShrink: 0 },
  btn: { width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnApprove: { background: '#e8f5e9', color: '#2e7d32' },
  btnReject: { background: '#fde8e8', color: '#b71c1c' },
  btnDelete: { background: '#f5f5f5', color: '#999' },
};
