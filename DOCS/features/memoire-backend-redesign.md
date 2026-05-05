# Memoire — Backend Design Migration (v2 — contrast & shape fixes)

> **What changed from v1:** The first pass applied colour tokens but broke contrast in several places
> and left shapes/typography untouched. This document fixes both. Read every section —
> do not skip sections that look "already done".
>
> **Untouchable:** `Viewer.jsx` and all viewer block components. Do not modify them.

---

## 0. Root cause of the contrast failures

The `--mv-accent` terracotta (`#c4795a`) was applied to text that should never use accent colour.
Terracotta is for **interactive highlights only** (active states, CTAs, badges for new items).
All body text, titles, slugs, and labels must use `--ink` / `--ink-soft` / `--ink-muted`.

Rule to follow throughout every component:
- Heading / title text → `var(--ink)`
- Secondary text → `var(--ink-soft)` or `var(--ink-muted)`
- Metadata / slugs → `var(--ink-faint)`
- Accent colour → only badges, active indicators, primary CTA buttons
- **Never** use `var(--mv-accent)` or `var(--accent)` as a text colour on light backgrounds

---

## 1. `frontend/src/index.css` — Critical fixes

### 1.1 Confirm font import is correct

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
```

### 1.2 Full `:root` block — paste this exactly, replacing whatever is there

```css
:root {
  /* ── palette ─────────────────────────────────────── */
  --ink:            #1a1814;
  --ink-soft:       #3d3a35;
  --ink-muted:      #7a756d;
  --ink-faint:      #b8b2a8;
  --paper:          #faf8f5;
  --paper-warm:     #f4f0ea;
  --paper-deep:     #ede8e0;
  --mv-accent:      #c4795a;
  --mv-accent-soft: #d9957a;
  --mv-accent-pale: #f2e4dc;
  --success:        #5a8a6a;
  --success-pale:   #e8f2ec;

  /* ── editor alias tokens ─────────────────────────── */
  --bg:             #f4f0ea;
  --surface:        #faf8f5;
  --border:         #e8e2d8;
  --border-strong:  #d4cec4;
  --text:           #1a1814;      /* = --ink  — used for body text */
  --text-muted:     #7a756d;      /* = --ink-muted */
  --text-faint:     #b8b2a8;      /* = --ink-faint */
  --accent:         #c4795a;      /* terracotta — interactive use only, NOT for text */
  --accent-hover:   #d9957a;
  --danger:         #b05050;
  --danger-hover:   #8f3f3f;

  /* ── typography ──────────────────────────────────── */
  --font-display:   'Cormorant Garamond', Georgia, serif;
  --font-body:      'DM Sans', system-ui, sans-serif;

  /* ── radii ───────────────────────────────────────── */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius:    6px;
  --radius-lg: 8px;

  /* ── shadows ─────────────────────────────────────── */
  --shadow-xs: 0 1px 3px rgba(26,24,20,0.07);
  --shadow-sm: 0 2px 8px rgba(26,24,20,0.09);
  --shadow-md: 0 8px 24px rgba(26,24,20,0.10);
  --shadow-lg: 0 24px 64px rgba(26,24,20,0.14);
}
```

### 1.3 Body — confirm these rules exist

```css
body {
  font-family: var(--font-body);
  font-weight: 300;
  color: var(--text);
  background: var(--bg);
}
```

### 1.4 Focus ring — fix the blue outline

The default browser blue focus ring is leaking. Add globally:

```css
*:focus-visible {
  outline: 1.5px solid var(--mv-accent);
  outline-offset: 2px;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--border-strong) !important;
  box-shadow: 0 0 0 2px rgba(196,121,90,0.15);
}
```

### 1.5 Buttons — full replacement

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 400;
  border-radius: var(--radius-sm);
  border: 0.5px solid transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}

/* Primary — dark ink, for confirm/neutral actions */
.btn-primary {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.btn-primary:hover {
  background: var(--ink-soft);
  border-color: var(--ink-soft);
}

/* Accent — terracotta, for main CTAs only (Publish, Nova Story) */
.btn-accent {
  background: var(--mv-accent);
  color: #fff;
  border-color: var(--mv-accent);
}
.btn-accent:hover {
  background: var(--mv-accent-soft);
  border-color: var(--mv-accent-soft);
  box-shadow: 0 2px 12px rgba(196,121,90,0.25);
}

/* Secondary — warm surface, for toolbar actions */
.btn-secondary {
  background: var(--paper-warm);
  color: var(--ink-soft);
  border-color: var(--border);
}
.btn-secondary:hover {
  background: var(--paper-deep);
  border-color: var(--border-strong);
  color: var(--ink);
}

/* Ghost — no background */
.btn-ghost {
  background: transparent;
  color: var(--ink-muted);
  border-color: transparent;
}
.btn-ghost:hover {
  background: var(--paper-warm);
  color: var(--ink);
}

/* Danger — destructive actions only */
.btn-danger {
  background: transparent;
  color: var(--danger);
  border-color: rgba(176,80,80,0.3);
}
.btn-danger:hover {
  background: rgba(176,80,80,0.07);
}
```

---

## 2. `frontend/src/pages/Dashboard.jsx` — Full style object replacement

Replace the entire `const s = { ... }` with the following. Do not keep old values.

```js
const s = {
  /* ── layout ── */
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-body)',
  },

  /* ── navbar ── */
  header: {
    background: 'var(--ink)',
    padding: '0 32px',
    height: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 400,
    letterSpacing: '0.02em',
    color: 'var(--paper)',           /* MUST be var(--paper), not accent */
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  navLink: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-faint)',       /* light on dark bg — correct contrast */
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    letterSpacing: '0.01em',
  },

  /* ── page body ── */
  body: {
    padding: '36px 32px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 28,
  },
  pageTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 400,
    color: 'var(--ink)',             /* MUST be var(--ink), not accent */
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  storyCount: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-muted)',       /* muted, not accent */
    letterSpacing: '0.04em',
  },

  /* ── cards grid ── */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'white',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: 'none',
  },
  /* Apply on hover via onMouseEnter / onMouseLeave: */
  /* transform: 'translateY(-2px)', boxShadow: 'var(--shadow-md)' */

  cardThumb: {
    height: 160,
    background: 'var(--paper-warm)',
    position: 'relative',
    overflow: 'hidden',
  },
  cardThumbEmpty: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, var(--paper-warm), var(--paper-deep))',
  },
  cardThumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  /* ── badges ── */
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    display: 'flex',
    gap: 5,
  },
  /* "Publicado" / "Rascunho" */
  badge: {
    fontSize: 10,
    fontWeight: 400,
    fontFamily: 'var(--font-body)',
    padding: '2px 8px',
    borderRadius: 2,
    letterSpacing: '0.04em',
    lineHeight: 1.6,
  },
  badgePublished: {
    background: 'var(--success-pale)',
    color: 'var(--success)',
    border: '0.5px solid rgba(90,138,106,0.25)',
  },
  badgeDraft: {
    background: 'rgba(250,248,245,0.92)',  /* semi-opaque paper on any thumb */
    color: 'var(--ink-muted)',
    border: '0.5px solid rgba(26,24,20,0.12)',
    backdropFilter: 'blur(4px)',
  },
  /* "N novas" — accent badge */
  badgeNew: {
    background: 'var(--mv-accent-pale)',
    color: 'var(--mv-accent)',
    border: '0.5px solid rgba(196,121,90,0.25)',
    fontSize: 10,
    fontWeight: 400,
    fontFamily: 'var(--font-body)',
    padding: '2px 8px',
    borderRadius: 2,
    letterSpacing: '0.04em',
    lineHeight: 1.6,
  },

  /* ── card body ── */
  cardBody: {
    padding: '12px 14px 14px',
  },
  cardTitle: {
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--ink)',             /* MUST be var(--ink), not accent */
    marginBottom: 6,
    letterSpacing: '-0.01em',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSlug: {
    fontSize: 11,
    fontWeight: 300,
    color: 'var(--ink-faint)',
    fontFamily: 'monospace',
  },
  cardActions: {
    display: 'flex',
    gap: 4,
  },
  iconBtn: {
    width: 26,
    height: 26,
    border: '0.5px solid var(--border)',
    borderRadius: 3,
    background: 'var(--paper-warm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--ink-muted)',
    transition: 'background 0.12s, color 0.12s',
  },
  /* on hover: background: 'var(--paper-deep)', color: 'var(--ink)' */

  /* ── sync notification badge in toolbar ── */
  syncBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    background: 'rgba(196,121,90,0.1)',
    border: '0.5px solid rgba(196,121,90,0.25)',
    borderRadius: 3,
    fontSize: 11,
    fontWeight: 400,
    color: 'var(--mv-accent)',       /* accent on dark navbar bg — readable */
    cursor: 'pointer',
  },
  /* NOTE: the emoji in "318 novas fotos" must be removed — use a plain SVG dot or none */
};
```

---

## 3. `frontend/src/pages/Editor.jsx` — Style fixes

### 3.1 Toolbar (`s.topbar`)

```js
topbar: {
  background: 'var(--paper)',
  borderBottom: '0.5px solid var(--border)',
  padding: '0 12px',
  height: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  zIndex: 10,
},
```

### 3.2 Sync notification badge in editor toolbar

The "318 novas fotos ✕" badge must not use emoji. Replace with:

```jsx
{syncCount > 0 && (
  <div style={s.syncBadge} onClick={handleSyncClick}>
    <svg width="6" height="6" viewBox="0 0 6 6">
      <circle cx="3" cy="3" r="3" fill="var(--mv-accent)"/>
    </svg>
    {syncCount} new photos
    <button style={s.syncDismiss} onClick={(e) => { e.stopPropagation(); dismissSync(); }}>✕</button>
  </div>
)}
```

```js
syncBadge: {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 8px',
  background: 'rgba(196,121,90,0.1)',
  border: '0.5px solid rgba(196,121,90,0.3)',
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 400,
  color: 'var(--mv-accent)',
  cursor: 'pointer',
},
syncDismiss: {
  background: 'none',
  border: 'none',
  fontSize: 10,
  color: 'var(--mv-accent-soft)',
  cursor: 'pointer',
  padding: '0 0 0 2px',
  lineHeight: 1,
},
```

### 3.3 Left sidebar

```js
sidebar: {
  background: 'var(--ink)',
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'hidden',
  flexShrink: 0,
  transition: 'width 0.2s ease',
},
sidebarHeader: {
  padding: '12px 14px 10px',
  borderBottom: '0.5px solid rgba(255,255,255,0.07)',
},
sidebarBack: {
  fontSize: 11,
  fontWeight: 300,
  color: 'var(--ink-faint)',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  marginBottom: 8,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
},
sidebarStoryTitle: {
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 400,
  color: 'var(--paper)',            /* light on dark sidebar */
  letterSpacing: '0.01em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
},
sidebarSectionLabel: {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(184,178,168,0.4)',
  padding: '8px 14px 4px',
},
blockItem: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '7px 14px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 300,
  color: 'rgba(184,178,168,0.7)',   /* visible but subdued on dark bg */
  transition: 'background 0.12s',
  borderLeft: '2px solid transparent',
},
blockItemActive: {
  background: 'rgba(196,121,90,0.12)',
  borderLeftColor: 'var(--mv-accent)',
  paddingLeft: 12,
  color: 'rgba(250,248,245,0.92)',  /* near-white — high contrast on dark */
},
blockItemNum: {
  fontSize: 10,
  color: 'rgba(184,178,168,0.35)',
},
blockItemNumActive: {
  color: 'var(--mv-accent-soft)',
},
```

### 3.4 Right properties panel

```js
props: {
  background: 'var(--paper)',
  borderLeft: '0.5px solid var(--border)',
  overflowY: 'auto',
  flexShrink: 0,
},
propsInner: {
  padding: '14px',
},
propsSectionTitle: {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 400,
  color: 'var(--ink)',              /* dark on light panel — correct */
  marginBottom: 14,
  letterSpacing: '0.01em',
},
```

### 3.5 Publish button states

```jsx
/* Unpublished — invite to publish */
<button className="btn btn-accent">Publicar</button>

/* Published — confirm/manage state */
<button className="btn btn-secondary">Publicado</button>

/* Unpublish action — separate smaller button or menu item */
<button className="btn btn-ghost" style={{ fontSize: 11 }}>Despublicar</button>
```

---

## 4. `frontend/src/components/editor/BlockEditor.jsx` — Style fixes

Replace the entire `const s = { ... }` with:

```js
const s = {
  wrap: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 400,
    color: 'var(--ink)',             /* dark — NOT accent */
    letterSpacing: '0.01em',
    marginBottom: 2,
    textTransform: 'none',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--ink-muted)',       /* was losing contrast — use muted not faint */
  },
  input: {
    padding: '7px 10px',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 300,
    fontFamily: 'var(--font-body)',
    width: '100%',
    background: 'var(--paper-warm)',
    color: 'var(--ink-soft)',
    outline: 'none',
    transition: 'border-color 0.12s, box-shadow 0.12s',
  },
  /* input:focus — handled globally in index.css */
  textarea: {
    padding: '7px 10px',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 300,
    fontFamily: 'var(--font-body)',
    width: '100%',
    minHeight: 72,
    resize: 'vertical',
    background: 'var(--paper-warm)',
    color: 'var(--ink-soft)',
    outline: 'none',
    lineHeight: 1.6,
  },
  select: {
    padding: '7px 10px',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 300,
    fontFamily: 'var(--font-body)',
    width: '100%',
    background: 'var(--paper-warm)',
    color: 'var(--ink-soft)',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
  },
  imagePreview: {
    width: '100%',
    aspectRatio: '16/9',
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--paper-deep)',
    display: 'block',
    border: '0.5px solid var(--border)',
  },
  imagePreviewEmpty: {
    width: '100%',
    aspectRatio: '16/9',
    background: 'var(--paper-deep)',
    borderRadius: 'var(--radius-sm)',
    border: '0.5px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPickFull: {
    padding: '7px 12px',
    border: '0.5px dashed var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--paper-warm)',
    fontSize: 11,
    fontWeight: 300,
    fontFamily: 'var(--font-body)',
    color: 'var(--ink-muted)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
    letterSpacing: '0.02em',
    transition: 'background 0.12s',
  },
  divider: {
    height: '0.5px',
    background: 'var(--border)',
    margin: '2px 0',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    cursor: 'pointer',
  },
  checkLabel: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-soft)',
  },
};
```

---

## 5. `frontend/src/components/editor/AssetPicker.jsx` — Full style replacement

The current file has raw hex values (`#fff`, `#1a1a1a`, `#f0f0f0`, `#eee`). Replace the entire `const s = { ... }` with:

```js
const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,24,20,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 'var(--radius-lg)',
    border: '0.5px solid var(--border)',
    width: '88vw',
    maxWidth: 960,
    height: '82vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    padding: '14px 20px',
    borderBottom: '0.5px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 400,
    color: 'var(--ink)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    color: 'var(--ink-faint)',
    lineHeight: 1,
    padding: '2px 4px',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  albumList: {
    width: 200,
    borderRight: '0.5px solid var(--border)',
    padding: '10px 8px',
    overflowY: 'auto',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    background: 'var(--paper-warm)',
  },
  toggleRow: {
    display: 'flex',
    gap: 3,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    padding: '5px 0',
    fontSize: 11,
    fontWeight: 400,
    fontFamily: 'var(--font-body)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-xs)',
    background: 'var(--paper)',
    cursor: 'pointer',
    color: 'var(--ink-muted)',
    transition: 'all 0.12s',
  },
  toggleBtnActive: {
    background: 'var(--ink)',
    color: 'var(--paper)',
    borderColor: 'var(--ink)',
    fontWeight: 400,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 500,
    color: 'var(--ink-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 4,
    marginTop: 6,
    padding: '0 4px',
  },
  albumBtn: {
    width: '100%',
    padding: '7px 8px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    fontWeight: 300,
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
    color: 'var(--ink-soft)',
    transition: 'background 0.1s',
  },
  albumBtnActive: {
    background: 'var(--mv-accent-pale)',
    color: 'var(--ink)',
  },
  albumName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  albumCount: {
    fontSize: 11,
    color: 'var(--ink-faint)',
    fontWeight: 300,
    flexShrink: 0,
  },
  assetArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    background: 'var(--paper)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
    gap: 5,
  },
  thumb: {
    position: 'relative',
    aspectRatio: '1/1',
    overflow: 'hidden',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'border-color 0.12s',
    background: 'var(--paper-deep)',
  },
  thumbSelected: {
    borderColor: 'var(--mv-accent)',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '0.5px solid var(--border)',
    background: 'var(--paper-warm)',
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexShrink: 0,
  },
  footerNote: {
    flex: 1,
    fontSize: 11,
    fontWeight: 300,
    color: 'var(--ink-muted)',
  },
};
```

---

## 6. ContributeModal — Style replacement

Locate `frontend/src/components/viewer/ContributeModal.jsx` (or equivalent). Replace `const s = { ... }`:

```js
const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26,24,20,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 8,
    border: '0.5px solid var(--border)',
    width: 400,
    maxWidth: '92vw',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    padding: '20px 24px 16px',
    textAlign: 'center',
    borderBottom: '0.5px solid var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 400,
    color: 'var(--ink)',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-muted)',
    lineHeight: 1.6,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--success-pale)',
    border: '0.5px solid rgba(90,138,106,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '18px auto 10px',
  },
  successTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 400,
    color: 'var(--ink)',
    textAlign: 'center',
    marginBottom: 4,
  },
  successSub: {
    fontSize: 12,
    fontWeight: 300,
    color: 'var(--ink-muted)',
    textAlign: 'center',
    marginBottom: 16,
  },
  fileList: {
    margin: '0 16px 16px',
    border: '0.5px solid var(--border)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--border)',
    background: 'var(--paper-warm)',
  },
  fileRowLast: {
    borderBottom: 'none',
  },
  fileThumb: {
    width: 36,
    height: 36,
    borderRadius: 3,
    objectFit: 'cover',
    background: 'var(--paper-deep)',
    flexShrink: 0,
  },
  fileThumbVideo: {
    width: 36,
    height: 36,
    borderRadius: 3,
    background: 'var(--ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: 400,
    color: 'var(--ink-soft)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileSize: {
    fontSize: 11,
    fontWeight: 300,
    color: 'var(--ink-faint)',
  },
  closeFooter: {
    padding: '0 16px 16px',
    textAlign: 'center',
  },
};
```

Success icon JSX — replace the green checkbox component with:

```jsx
<div style={s.successIcon}>
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
       stroke="#5a8a6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3,9 7,13 15,5"/>
  </svg>
</div>
```

---

## 7. Global audit — find and fix remaining hardcoded values

Run these searches across all files in `frontend/src/` (excluding `components/blocks/` and `pages/Viewer.jsx`):

```
grep -r "#f5f5f4\|#ffffff\|#fff\b\|#111827\|#6b7280\|#9ca3af\|#e5e7eb\|#1a1a1a\|#f0f0f0\|Inter" src/
```

For each match, replace with the appropriate token:
- `#ffffff` / `#fff` → `var(--paper)` or `var(--surface)`
- `#f5f5f4` / `#f0f0f0` → `var(--paper-warm)` or `var(--bg)`
- `#111827` / `#1a1a1a` → `var(--ink)`
- `#6b7280` → `var(--ink-muted)`
- `#9ca3af` → `var(--ink-faint)`
- `#e5e7eb` / `#eee` → `var(--border)`
- `'Inter'` → `var(--font-body)`

---

## 8. Contrast checklist — verify before committing

After all changes, visually confirm each item below passes:

- [ ] Dashboard page title "As tuas stories" — dark `var(--ink)` on warm `var(--bg)` ✓
- [ ] Card titles (story names) — `var(--ink)` on white card ✓
- [ ] Card slugs — `var(--ink-faint)` on white card (subtle but readable) ✓
- [ ] "Rascunho" badge — semi-opaque paper background + `var(--ink-muted)` text, visible on any thumbnail colour ✓
- [ ] "Publicado" badge — `var(--success)` green on `var(--success-pale)` ✓
- [ ] "N novas" badge — `var(--mv-accent)` terracotta on `var(--mv-accent-pale)` ✓
- [ ] Sidebar block labels — `rgba(184,178,168,0.7)` on `var(--ink)` dark sidebar ✓
- [ ] Active sidebar item — `rgba(250,248,245,0.92)` near-white on dark sidebar ✓
- [ ] Properties panel labels — `var(--ink-muted)` on `var(--paper)` ✓
- [ ] Input placeholder text — default browser placeholder on `var(--paper-warm)` bg ✓
- [ ] Input focus ring — terracotta glow, no blue ✓
- [ ] Nav links — `var(--ink-faint)` on `var(--ink)` dark navbar ✓
