import { useEffect, useState } from 'react';

const LogomarkSVG = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--paper)" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="6" height="6" opacity="1" rx="0.5" />
    <rect x="8" y="0" width="6" height="6" opacity="0.6" rx="0.5" />
    <rect x="0" y="8" width="6" height="6" opacity="0.4" rx="0.5" />
    <rect x="8" y="8" width="6" height="6" opacity="0.3" rx="0.5" />
  </svg>
);

const ShareIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const PeopleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

export default function ViewerTopbar({ onPeopleToggle, peopleVisible, storyTitle }) {
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY >= 10); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: storyTitle || 'Memoire', url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <header className="mv-topbar" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', height: 52,
      background: 'color-mix(in srgb, var(--paper) 88%, transparent)',
      backdropFilter: 'blur(16px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      borderBottom: `1px solid color-mix(in srgb, var(--paper-deep) ${scrolled ? '80%' : '60%'}, transparent)`,
      transition: 'border-color 300ms var(--ease)',
    }}>
      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 26, height: 26, background: 'var(--ink)', borderRadius: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <LogomarkSVG />
        </div>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '1.1rem',
          fontWeight: 400, letterSpacing: '0.04em', color: 'var(--ink)',
        }}>Memoire</span>
      </a>

      {/* Right buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {onPeopleToggle && (
          <button
            onClick={onPeopleToggle}
            title="Filtrar por pessoa"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: peopleVisible ? 'var(--paper-deep)' : 'var(--paper-warm)',
              border: `1px solid ${peopleVisible ? 'var(--ink-faint)' : 'var(--paper-deep)'}`,
              borderRadius: 20, padding: '5px 12px',
              fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 300,
              color: 'var(--ink-muted)', cursor: 'pointer',
              transition: 'all 200ms var(--ease-out)',
            }}
          >
            <PeopleIcon /> Pessoas
          </button>
        )}

        <button
          onClick={handleShare}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 400,
            color: 'var(--ink-soft)', background: 'transparent',
            border: '1px solid var(--paper-deep)', borderRadius: 20, padding: '5px 14px',
            cursor: 'pointer', transition: 'all 200ms var(--ease-out)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ink-faint)'; e.currentTarget.style.background = 'var(--paper-warm)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--paper-deep)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
        >
          <ShareIcon /> {copied ? 'Copiado!' : 'Partilhar'}
        </button>
      </div>
    </header>
  );
}
