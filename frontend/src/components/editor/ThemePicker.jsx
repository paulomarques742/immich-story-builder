import { useState, useEffect } from 'react';
import { THEMES, getTheme } from '../../lib/themes.js';

export default function ThemePicker({ storyId, currentTheme, onSaved, onClose }) {
  const parsed = currentTheme
    ? (typeof currentTheme === 'string' ? JSON.parse(currentTheme) : currentTheme)
    : { id: 'memoire', accent: null };

  const [selectedId, setSelectedId] = useState(parsed.id ?? 'memoire');
  const [accent, setAccent] = useState(parsed.accent ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const h = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

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

  const overlayStyle = isMobile
    ? {}
    : { background: 'rgba(26,24,20,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const modalStyle = isMobile
    ? { position: 'fixed', inset: 0, background: 'var(--paper)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.25rem 1rem' }
    : {
        width: 540,
        maxWidth: 'calc(100vw - 2rem)',
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '1.75rem',
        boxShadow: '0 24px 64px rgba(26,24,20,0.2)',
      };

  return (
    <div
      className="fixed inset-0 z-[200]"
      style={overlayStyle}
      onClick={isMobile ? undefined : onClose}
    >
      <div
        className="flex flex-col gap-5"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl italic font-light text-ink leading-none">Tema da story</h3>
            <p className="text-xs font-light text-ink-faint mt-1.5">Paleta de cores e tipografia</p>
          </div>
          <button className="btn btn-ghost btn-sm text-ink-faint" onClick={onClose}>✕</button>
        </div>

        {/* Theme grid — 2 cols on mobile, 3 on wider */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>
          {THEMES.map((t) => {
            const active = selectedId === t.id;
            return (
              <button
                key={t.id}
                className="text-left cursor-pointer transition-all"
                style={{
                  padding: '12px 12px',
                  border: `1.5px solid ${active ? 'var(--mv-accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: active ? 'var(--mv-accent-pale)' : 'var(--paper-warm)',
                  boxShadow: active ? '0 0 0 3px var(--mv-accent-pale)' : '0 1px 3px rgba(26,24,20,0.05)',
                  transition: 'border-color 0.12s, box-shadow 0.12s, background 0.12s',
                }}
                onClick={() => setSelectedId(t.id)}
              >
                <div className="flex gap-1 mb-2.5">
                  <div className="w-4 h-4 rounded border border-black/10" style={{ background: t.vars['--paper'] }} />
                  <div className="w-4 h-4 rounded border border-black/10" style={{ background: t.vars['--ink'] }} />
                  <div className="w-4 h-4 rounded border border-black/10" style={{ background: t.accentDefault }} />
                </div>
                <div className="text-sm font-normal text-ink mb-0.5">{t.name}</div>
                <div className="text-xs font-light text-ink-muted leading-snug">{t.description}</div>
              </button>
            );
          })}
        </div>

        {/* Accent override */}
        <div className="flex items-center gap-3 pt-1 border-t border-border">
          <label className="text-sm font-light text-ink-muted shrink-0">Cor de destaque</label>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-5 h-5 rounded border border-border-strong shrink-0"
              style={{ background: accentColor }}
            />
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccent(e.target.value)}
              className="border border-border rounded cursor-pointer"
              style={{ width: 32, height: 28, padding: 2 }}
              title="Escolher cor de destaque"
            />
            <span className="text-xs font-light text-ink-faint font-mono">{accentColor}</span>
            {accent && (
              <button className="btn btn-ghost btn-sm text-ink-faint" onClick={() => setAccent('')}>Repor</button>
            )}
          </div>
        </div>

        {/* Preview strip */}
        <div
          className="flex items-center gap-5 rounded-lg border overflow-x-auto"
          style={{
            padding: '14px 18px',
            background: theme.vars['--paper'],
            borderColor: theme.vars['--paper-deep'],
          }}
        >
          <span style={{ fontFamily: theme.vars['--font-display'], fontSize: 20, color: theme.vars['--ink'], fontStyle: 'italic', fontWeight: 300, whiteSpace: 'nowrap' }}>
            Título da story
          </span>
          <span style={{ fontFamily: theme.vars['--font-body'], fontSize: 13, color: theme.vars['--ink-muted'], whiteSpace: 'nowrap' }}>
            Texto do corpo
          </span>
          <span style={{ fontFamily: theme.vars['--font-body'], fontSize: 11, color: accentColor, fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            Destaque
          </span>
        </div>

        {/* Footer */}
        {msg ? (
          <p className="text-sm font-light text-success bg-success-pale px-3 py-2.5 rounded-sm border border-success/25">{msg}</p>
        ) : (
          <div className="flex gap-2 justify-end">
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
