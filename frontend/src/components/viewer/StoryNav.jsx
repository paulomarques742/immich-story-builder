import { useEffect, useState } from 'react';

function parse(block) {
  try { return typeof block.content === 'string' ? JSON.parse(block.content) : block.content; }
  catch { return {}; }
}

export default function StoryNav({ blocks, visible }) {
  const [activeId, setActiveId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = blocks
    .filter((b) => {
      if (b.type === 'divider') return true;
      if (b.type === 'text') { const c = parse(b); return c.markdown?.trimStart().startsWith('#'); }
      return false;
    })
    .map((b) => {
      const c = parse(b);
      let label = '';
      if (b.type === 'divider') label = c.label || '—';
      if (b.type === 'text') label = c.markdown.match(/^#+\s*(.+)/m)?.[1] || '';
      return { id: b.id, label };
    });

  useEffect(() => {
    if (!visible || sections.length === 0) return;

    const observers = [];
    const visibleRatios = {};

    sections.forEach(({ id }) => {
      const el = document.getElementById(`block-${id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          visibleRatios[id] = entry.intersectionRatio;
          const best = Object.entries(visibleRatios).sort((a, b) => b[1] - a[1])[0];
          if (best && best[1] > 0) setActiveId(Number(best[0]));
        },
        { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1.0] }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [blocks, visible]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (!visible || sections.length === 0) return null;

  function scrollTo(id) {
    document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
    {/* Mobile: floating button + section sheet (desktop side nav is hidden ≤720px) */}
    <button
      type="button"
      className="mv-nav-fab"
      aria-label="Índice"
      aria-expanded={mobileOpen}
      onClick={() => setMobileOpen((o) => !o)}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
        <line x1="9" y1="6" x2="20" y2="6" />
        <line x1="9" y1="12" x2="20" y2="12" />
        <line x1="9" y1="18" x2="20" y2="18" />
      </svg>
    </button>

    {mobileOpen && (
      <div className="mv-nav-sheet-backdrop" onClick={() => setMobileOpen(false)}>
        <div className="mv-nav-sheet" role="dialog" aria-label="Índice" onClick={(e) => e.stopPropagation()}>
          <div className="mv-nav-sheet-title">Índice</div>
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#block-${sec.id}`}
              className={`mv-nav-sheet-item${activeId === sec.id ? ' mv-nav-sheet-active' : ''}`}
              onClick={(e) => { e.preventDefault(); setMobileOpen(false); scrollTo(sec.id); }}
            >
              {sec.label}
            </a>
          ))}
        </div>
      </div>
    )}

    <nav className="mv-side-nav" style={{
      position: 'fixed', right: '2rem', top: '50%',
      transform: 'translateY(-50%)', zIndex: 50,
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end',
    }}>
      {sections.map((sec) => {
        const isActive = activeId === sec.id;
        return (
          <a
            key={sec.id}
            onClick={(e) => { e.preventDefault(); scrollTo(sec.id); }}
            href={`#block-${sec.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', textDecoration: 'none',
            }}
            className={`mv-nav-item${isActive ? ' mv-nav-active' : ''}`}
            onMouseEnter={(e) => {
              const label = e.currentTarget.querySelector('.mv-nav-label');
              const dot = e.currentTarget.querySelector('.mv-nav-dot');
              if (label) { label.style.opacity = '1'; label.style.transform = 'translateX(0)'; }
              if (dot && !isActive) { dot.style.width = '7px'; dot.style.height = '7px'; dot.style.background = 'var(--ink)'; }
            }}
            onMouseLeave={(e) => {
              const label = e.currentTarget.querySelector('.mv-nav-label');
              const dot = e.currentTarget.querySelector('.mv-nav-dot');
              if (label && !isActive) { label.style.opacity = '0'; label.style.transform = 'translateX(4px)'; }
              if (dot && !isActive) { dot.style.width = '5px'; dot.style.height = '5px'; dot.style.background = 'var(--ink-faint)'; }
            }}
          >
            <span
              className="mv-nav-label"
              style={{
                fontSize: '0.7rem', fontWeight: 400, color: 'var(--ink-muted)',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateX(0)' : 'translateX(4px)',
                transition: 'all 220ms var(--ease-out)',
                whiteSpace: 'nowrap', pointerEvents: 'none',
              }}
            >{sec.label}</span>
            <span
              className="mv-nav-dot"
              style={{
                width: isActive ? 7 : 5,
                height: isActive ? 7 : 5,
                borderRadius: '50%',
                background: isActive ? 'var(--mv-accent)' : 'var(--ink-faint)',
                transition: 'all 220ms var(--ease-out)',
                flexShrink: 0,
                display: 'block',
              }}
            />
          </a>
        );
      })}
    </nav>
    </>
  );
}
