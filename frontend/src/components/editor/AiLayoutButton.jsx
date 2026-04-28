import { useState, useEffect } from 'react';
import api from '../../lib/api.js';

export default function AiLayoutButton({ onTrigger, disabled }) {
  const [open, setOpen] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [language, setLanguage] = useState('pt');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [sharedOnly, setSharedOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    api.get(`/api/immich/albums${sharedOnly ? '?shared=true' : ''}`)
      .then((r) => setAlbums(r.data))
      .catch(() => setError('Não foi possível carregar álbuns.'))
      .finally(() => setLoading(false));
  }, [open, sharedOnly]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (selected.size === 0) return;
    try {
      await onTrigger({ albumIds: [...selected], language, replaceExisting });
      setOpen(false);
    } catch (err) {
      if (err?.response?.status === 501) setUnavailable(true);
      setError(err?.response?.data?.error || 'Erro ao iniciar AI Layout');
    }
  }

  if (unavailable) {
    return (
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <button className="btn btn-secondary" disabled title="Adiciona GEMINI_API_KEY ao .env para activar AI Layout" style={{ opacity: 0.6 }}>
          ✨ AI Layout
          <span style={s.badge}>Config</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="Gerar story automaticamente com IA"
      >
        ✨ AI Layout
      </button>

      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.header}>
              <h3 style={s.title}>✨ AI Layout</h3>
              <button style={s.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>

            <div style={s.body}>
              <p style={s.desc}>
                Selecciona álbuns para analisar. O Gemini avalia cada foto e gera uma story narrativa com heroes, texto e grids organizadas por localização e tema.
              </p>

              <label style={s.filterRow}>
                <input type="checkbox" checked={sharedOnly} onChange={(e) => setSharedOnly(e.target.checked)} />
                Só álbuns partilhados
              </label>

              {loading && <p style={s.hint}>A carregar álbuns...</p>}
              {error && <p style={s.error}>{error}</p>}

              <div style={s.list}>
                {albums.map((a) => (
                  <label key={a.id} style={s.item}>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      style={{ flexShrink: 0 }}
                    />
                    <span style={s.albumName}>{a.albumName}</span>
                    <span style={s.albumCount}>{a.assetCount ?? 0} fotos</span>
                  </label>
                ))}
                {!loading && albums.length === 0 && !error && (
                  <p style={s.hint}>Sem álbuns disponíveis</p>
                )}
              </div>

              <div style={s.options}>
                <label style={s.optionRow}>
                  <span style={s.optionLabel}>Idioma do texto</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={s.select}
                  >
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </label>
                <label style={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  <span style={{ fontSize: 13 }}>Substituir blocos existentes</span>
                </label>
              </div>
            </div>

            <div style={s.footer}>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={selected.size === 0}
              >
                {`Gerar story${selected.size > 0 ? ` (${selected.size} álbum${selected.size > 1 ? 'ns' : ''})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const s = {
  badge: {
    display: 'inline-block',
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 4,
    background: 'var(--text-muted)',
    color: 'var(--surface)',
    verticalAlign: 'middle',
    letterSpacing: '0.02em',
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, backdropFilter: 'blur(2px)',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    width: 480, maxWidth: 'calc(100vw - 2rem)', maxHeight: '76vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: { fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 16, cursor: 'pointer',
    color: 'var(--text-faint)', width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  },
  body: { padding: '16px 20px', flex: 1, overflowY: 'auto' },
  desc: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 },
  hint: { color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  error: {
    color: 'var(--danger)', fontSize: 13, marginBottom: 8,
    padding: '8px 12px', background: '#fef2f2', borderRadius: 'var(--radius-sm)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 },
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', fontSize: 14, transition: 'background 0.1s',
  },
  albumName: { flex: 1, fontWeight: 500, fontSize: 13 },
  albumCount: { fontSize: 12, color: 'var(--text-faint)' },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 12, color: 'var(--text-muted)',
    marginBottom: 14, cursor: 'pointer', fontWeight: 500,
  },
  options: {
    borderTop: '1px solid var(--border)',
    paddingTop: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  optionRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 13,
  },
  optionLabel: { color: 'var(--text)', fontWeight: 500 },
  select: {
    fontSize: 13, padding: '4px 8px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', cursor: 'pointer',
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    flexShrink: 0,
  },
};
