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
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  modal: {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
    padding: '24px 24px 20px', width: 520, maxWidth: '95vw',
    boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 16,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-faint)',
    fontSize: 14, cursor: 'pointer', padding: '2px 6px',
  },
  sub: { fontSize: 13, color: 'var(--text-muted)', marginTop: -8 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
  },
  card: {
    background: 'var(--bg)', border: '2px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '12px 10px',
    cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s, box-shadow 0.12s',
  },
  cardActive: {
    borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)',
  },
  swatch: { width: 18, height: 18, borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)' },
  cardName: { fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 },
  cardDesc: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 },
  accentRow: { display: 'flex', alignItems: 'center', gap: 12 },
  label: { fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 },
  accentControls: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  accentPreview: { width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border-strong)', flexShrink: 0 },
  colorInput: { width: 32, height: 28, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 2 },
  accentHex: { fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' },
  resetBtn: {
    fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)',
    padding: '2px 7px', cursor: 'pointer',
  },
  preview: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '12px 16px', borderRadius: 'var(--radius)',
    border: '1px solid', transition: 'background 0.2s',
  },
  msg: { fontSize: 13, color: '#059669', background: '#f0fdf4', padding: '8px 12px', borderRadius: 'var(--radius-sm)' },
  footer: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
};
