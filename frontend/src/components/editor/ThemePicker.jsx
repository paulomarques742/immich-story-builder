import { useState } from 'react';
import { THEMES, getTheme } from '../../lib/themes.js';

export default function ThemePicker({ storyId, currentTheme, onSaved, onClose }) {
  const parsed = currentTheme
    ? (typeof currentTheme === 'string' ? JSON.parse(currentTheme) : currentTheme)
    : { id: 'memoire', accent: null };

  const [selectedId, setSelectedId] = useState(parsed.id ?? 'memoire');
  const [accent, setAccent] = useState(parsed.accent ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const theme = getTheme(selectedId);
  const accentColor = accent || theme.accentDefault;

  async function save() {
    setSaving(true);
    try {
      const { default: api } = await import('../../lib/api.js');
      await api.put(`/api/stories/${storyId}`, {
        theme: { id: selectedId, accent: accent || null },
      });
      setMsg('Tema guardado.');
      onSaved({ id: selectedId, accent: accent || null });
      setTimeout(onClose, 900);
    } catch {
      setMsg('Erro ao guardar tema.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h3 style={s.title}>Tema da storie</h3>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={s.sub}>Escolhe a paleta de cores e tipografia.</p>

        {/* Theme grid */}
        <div style={s.grid}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              style={{
                ...s.card,
                ...(selectedId === t.id ? s.cardActive : {}),
              }}
              onClick={() => setSelectedId(t.id)}
            >
              {/* Colour swatch */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                <div style={{ ...s.swatch, background: t.vars['--paper'] }} />
                <div style={{ ...s.swatch, background: t.vars['--ink'] }} />
                <div style={{ ...s.swatch, background: t.accentDefault }} />
              </div>
              <div style={s.cardName}>{t.name}</div>
              <div style={s.cardDesc}>{t.description}</div>
            </button>
          ))}
        </div>

        {/* Accent override */}
        <div style={s.accentRow}>
          <label style={s.label}>Cor de destaque</label>
          <div style={s.accentControls}>
            <div style={{ ...s.accentPreview, background: accentColor }} />
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccent(e.target.value)}
              style={s.colorInput}
              title="Escolher cor de destaque"
            />
            <span style={s.accentHex}>{accentColor}</span>
            {accent && (
              <button
                style={s.resetBtn}
                onClick={() => setAccent('')}
                title="Repor cor do tema"
              >
                Repor
              </button>
            )}
          </div>
        </div>

        {/* Preview strip */}
        <div style={{
          ...s.preview,
          background: theme.vars['--paper'],
          borderColor: theme.vars['--paper-deep'],
        }}>
          <span style={{
            fontFamily: theme.vars['--font-display'],
            fontSize: 18,
            color: theme.vars['--ink'],
            fontStyle: 'italic',
            fontWeight: 300,
          }}>
            Título da storie
          </span>
          <span style={{
            fontFamily: theme.vars['--font-body'],
            fontSize: 12,
            color: theme.vars['--ink-muted'],
          }}>
            Texto do corpo
          </span>
          <span style={{
            fontFamily: theme.vars['--font-body'],
            fontSize: 11,
            color: accentColor,
            fontWeight: 500,
          }}>
            Destaque
          </span>
        </div>

        {msg ? (
          <p style={s.msg}>{msg}</p>
        ) : (
          <div style={s.footer}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? '…' : 'Guardar tema'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)', borderRadius: 'var(--radius-lg)',
    padding: '24px 24px 20px', width: 520, maxWidth: '95vw',
    boxShadow: 'var(--shadow-lg)', border: '0.5px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: 'var(--ink)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--ink-faint)',
    fontSize: 14, cursor: 'pointer', padding: '2px 6px',
  },
  sub: { fontSize: 13, fontWeight: 300, color: 'var(--ink-muted)', marginTop: -8 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
  },
  card: {
    background: 'var(--paper-warm)', border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '12px 10px',
    cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s, box-shadow 0.12s',
  },
  cardActive: {
    borderColor: 'var(--mv-accent)', boxShadow: '0 0 0 2px var(--mv-accent-pale)',
  },
  swatch: { width: 16, height: 16, borderRadius: 3, border: '0.5px solid rgba(0,0,0,0.1)' },
  cardName: { fontSize: 13, fontWeight: 400, color: 'var(--ink)', marginBottom: 2 },
  cardDesc: { fontSize: 11, fontWeight: 300, color: 'var(--ink-muted)', lineHeight: 1.4 },
  accentRow: { display: 'flex', alignItems: 'center', gap: 12 },
  label: { fontSize: 12, fontWeight: 300, color: 'var(--ink-muted)', flexShrink: 0 },
  accentControls: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  accentPreview: { width: 22, height: 22, borderRadius: 4, border: '0.5px solid var(--border-strong)', flexShrink: 0 },
  colorInput: { width: 30, height: 26, border: '0.5px solid var(--border)', borderRadius: 3, cursor: 'pointer', padding: 2 },
  accentHex: { fontSize: 11, fontWeight: 300, color: 'var(--ink-muted)', fontFamily: 'monospace' },
  resetBtn: {
    fontSize: 11, fontWeight: 300, color: 'var(--ink-muted)', background: 'var(--paper-warm)',
    border: '0.5px solid var(--border)', borderRadius: 'var(--radius-xs)',
    padding: '2px 7px', cursor: 'pointer',
  },
  preview: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '12px 16px', borderRadius: 'var(--radius)',
    border: '0.5px solid', transition: 'background 0.2s',
  },
  msg: {
    fontSize: 13, fontWeight: 300, color: 'var(--success)',
    background: 'var(--success-pale)', padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '0.5px solid rgba(90,138,106,0.25)',
  },
  footer: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
};
