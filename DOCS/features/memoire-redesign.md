# Memoire — Backend Design Migration

> **Goal:** Unify the visual language of the dashboard and editor with the public viewer.
> The public viewer (`Viewer.jsx`) is the **untouchable reference** — do not modify any viewer files.
> Files to change: `index.css`, `Dashboard.jsx`, `Editor.jsx`, `BlockEditor.jsx`, `AssetPicker.jsx`, and the public `ContributeModal` (or equivalent).

---

## 0. Context

The backend currently uses a generic design system (Inter, `#f5f5f4`, tokens `--bg`/`--surface`/`--border`) completely disconnected from the viewer, which uses Cormorant Garamond + DM Sans, a warm paper palette, and a terracotta accent.

The result is two visually distinct products inside the same app. This migration fixes that **without touching the viewer**.

---

## 1. `frontend/src/index.css` — Tokens and fonts

### 1.1 Google Fonts — replace Inter import

```css
/* BEFORE */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* AFTER */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
```

### 1.2 Remap editor tokens to the Memoire palette

Inside `:root`, **replace** the editor tokens with the block below. Viewer tokens (`--ink`, `--paper`, etc.) already exist — keep them. Only change the tokens listed here:

```css
:root {
  /* viewer tokens — keep as-is */
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
  --font-display:   'Cormorant Garamond', Georgia, serif;
  --font-body:      'DM Sans', system-ui, sans-serif;

  /* editor tokens — REPLACE */
  --bg:             #f4f0ea;      /* was #f5f5f4 */
  --surface:        #faf8f5;      /* was #ffffff */
  --border:         #e8e2d8;      /* was #e5e7eb */
  --border-strong:  #d4cec4;      /* was #c8ccd4 */
  --text:           #1a1814;      /* was #111827 */
  --text-muted:     #7a756d;      /* was #6b7280 */
  --text-faint:     #b8b2a8;      /* was #9ca3af */
  --accent:         #c4795a;      /* was #18181b — now terracotta */
  --accent-hover:   #d9957a;      /* was #27272a */
  --danger:         #b05050;
  --danger-hover:   #8f3f3f;

  /* radii — less rounded, more editorial */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius:    6px;
  --radius-lg: 8px;
}
```

### 1.3 Body font — replace Inter with DM Sans

```css
body {
  font-family: var(--font-body);   /* was 'Inter', system-ui */
  font-weight: 300;                /* add this */
  /* rest unchanged */
}
```

### 1.4 Buttons — update classes

```css
/* btn-primary: dark ink for neutral/confirm actions */
.btn-primary {
  background: var(--ink);          /* was var(--accent) */
  color: var(--paper);
}
.btn-primary:hover {
  background: var(--ink-soft);
  box-shadow: 0 1px 4px rgba(26,24,20,0.2);
}

/* btn-accent: new class — main CTA in terracotta */
.btn-accent {
  background: var(--mv-accent);
  color: #fff;
}
.btn-accent:hover {
  background: var(--mv-accent-soft);
  box-shadow: 0 4px 16px rgba(196,121,90,0.28);
}

/* btn-secondary: warm surface */
.btn-secondary {
  background: var(--paper-warm);
  color: var(--ink-soft);
  border: 0.5px solid var(--border);
}
.btn-secondary:hover {
  background: var(--paper-deep);
  border-color: var(--border-strong);
  color: var(--ink);
}

/* btn-ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}
.btn-ghost:hover {
  background: var(--paper-warm);
  color: var(--ink);
}
```

---

## 2. `frontend/src/pages/Dashboard.jsx`

### 2.1 Navbar (`s.header`)

```js
header: {
  background: 'var(--ink)',                  /* was var(--surface) white */
  borderBottom: 'none',                      /* was 1px solid var(--border) */
  padding: '0 32px',
  height: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  zIndex: 10,
},
```

### 2.2 Logo — replace colored square with SVG mark + Cormorant

Replace the current logo block (the `M` square + bold text) with:

```jsx
<div style={s.headerLeft}>
  <svg width="22" height="22" viewBox="0 0 20 20" fill="#faf8f5" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="7" height="10" rx="0.5"/>
    <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
    <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
    <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
  </svg>
  <span style={s.logoText}>Memoire</span>
</div>
```

```js
logoText: {
  fontFamily: 'var(--font-display)',
  fontSize: 17,
  fontWeight: 400,
  letterSpacing: '0.02em',
  color: 'var(--paper)',             /* was var(--text) */
},
```

### 2.3 Nav links and email

```js
userEmail: {
  fontSize: 12,
  fontWeight: 300,
  color: 'var(--ink-faint)',         /* was var(--text-muted) */
  marginRight: 4,
},
```

### 2.4 "+ Nova Story" button

Change class to `btn btn-accent` (terracotta) instead of `btn btn-primary`.

### 2.5 Page title

```js
pageTitle: {
  fontFamily: 'var(--font-display)',
  fontSize: 26,
  fontWeight: 400,                   /* was 700 */
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
},
storyCount: {
  fontSize: 12,
  fontWeight: 300,
  color: 'var(--ink-muted)',
  letterSpacing: '0.04em',
},
```

### 2.6 Story cards

```js
card: {
  cursor: 'pointer',
  overflow: 'hidden',
  borderRadius: 'var(--radius)',     /* was var(--radius-lg) */
  border: '0.5px solid var(--border)',
  background: 'white',
  boxShadow: 'none',                 /* was var(--shadow-xs) */
  transition: 'box-shadow 0.2s, transform 0.2s',
},
/* hover — add via onMouseEnter/Leave or CSS class: */
/* transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,24,20,0.09) */

cardThumb: {
  height: 150,                       /* was 168 */
  background: 'var(--paper-warm)',   /* was #f3f4f6 */
  position: 'relative',
  overflow: 'hidden',
},
```

### 2.7 Status badges

Replace existing inline badge styles with:

```js
/* "Publicado" */
badgePublished: {
  position: 'absolute',
  top: 8,
  left: 8,
  fontSize: 10,
  fontWeight: 400,
  fontFamily: 'var(--font-body)',
  padding: '2px 8px',
  borderRadius: 2,
  letterSpacing: '0.04em',
  background: 'var(--success-pale)',
  color: 'var(--success)',
  border: '0.5px solid rgba(90,138,106,0.2)',
},

/* "N novas" */
badgeNew: {
  position: 'absolute',
  top: 8,
  left: /* adjust per position */,
  fontSize: 10,
  fontWeight: 400,
  fontFamily: 'var(--font-body)',
  padding: '2px 8px',
  borderRadius: 2,
  letterSpacing: '0.04em',
  background: 'var(--mv-accent-pale)',
  color: 'var(--mv-accent)',
  border: '0.5px solid rgba(196,121,90,0.2)',
},
```

### 2.8 Card title and slug

```js
cardTitle: {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 400,                   /* was 600 */
  color: 'var(--ink)',
  marginBottom: 6,
},
cardSlug: {
  fontSize: 11,
  color: 'var(--ink-faint)',
  fontWeight: 300,
},
```

### 2.9 Action icon buttons (settings and delete)

```js
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
},
```

---

## 3. `frontend/src/pages/Editor.jsx`

### 3.1 Top toolbar (`s.topbar`)

```js
topbar: {
  background: 'var(--paper)',        /* was var(--surface) */
  borderBottom: '0.5px solid var(--border)',
  padding: '0 14px',
  height: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  zIndex: 10,
},
```

### 3.2 "← Dashboard" button

Change to `btn btn-ghost`. Ensure `color: var(--ink-muted)` with hover `var(--ink)`.

### 3.3 Story title in toolbar

```js
storyTitle: {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 400,
  color: 'var(--ink)',
  letterSpacing: '0.01em',
},
```

### 3.4 Left sidebar (`s.sidebar`)

```js
sidebar: {
  background: 'var(--ink)',          /* was var(--surface) white */
  borderRight: 'none',
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'hidden',
  flexShrink: 0,
  transition: 'width 0.2s ease',
},
sidebarLabel: {
  fontSize: 9,
  color: 'rgba(184,178,168,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 500,
},
```

### 3.5 Sidebar block items

```js
/* base item */
blockItem: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '7px 14px',
  cursor: 'pointer',
  color: 'var(--ink-faint)',
  fontSize: 12,
  fontWeight: 300,
  transition: 'background 0.15s',
},

/* active item — apply when block is selected */
blockItemActive: {
  background: 'rgba(196,121,90,0.12)',
  borderLeft: '2px solid var(--mv-accent)',
  paddingLeft: 12,
  color: 'rgba(250,248,245,0.9)',
},

/* block number */
blockItemNum: {
  fontSize: 10,
  color: 'rgba(184,178,168,0.4)',
},
blockItemNumActive: {
  color: 'var(--mv-accent-soft)',
},
```

### 3.6 Right properties panel (`s.props`)

```js
props: {
  background: 'var(--paper)',        /* was var(--surface) */
  borderLeft: '0.5px solid var(--border)',
  overflowY: 'auto',
  flexShrink: 0,
  transition: 'width 0.2s ease',
},
```

### 3.7 Publish / Unpublish button

- **Published state**: use `btn btn-secondary` (not red/danger)
- **Publish CTA**: use `btn btn-accent` (terracotta)
- Never use `btn-danger` for the publish toggle — reserve danger only for delete actions

### 3.8 "Importar álbum" and "AI Layout" toolbar buttons

Use `btn btn-secondary` (warm paper surface, subtle border).

---

## 4. `frontend/src/components/editor/BlockEditor.jsx`

### 4.1 Section heading (`s.heading`)

```js
heading: {
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 400,                   /* was 700 */
  letterSpacing: '0.01em',
  color: 'var(--ink)',
  marginBottom: 2,
  textTransform: 'none',             /* was capitalize — remove */
},
```

### 4.2 Field labels (`s.label`)

```js
label: {
  fontSize: 10,
  color: 'var(--ink-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 500,                   /* was 600 */
},
```

### 4.3 Inputs (`s.input`)

```js
input: {
  padding: '7px 10px',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  fontWeight: 300,
  width: '100%',
  background: 'var(--paper-warm)',   /* was var(--surface) white */
  color: 'var(--ink-soft)',
  outline: 'none',
  transition: 'border-color 0.12s',
},
```

### 4.4 "Select from library" button (`s.btnPickFull`)

```js
btnPickFull: {
  padding: '8px 12px',
  border: '0.5px dashed var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--paper-warm)',
  fontSize: 12,
  fontWeight: 300,
  color: 'var(--ink-muted)',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'center',
  transition: 'background 0.12s, border-color 0.12s',
},
```

---

## 5. `frontend/src/components/editor/AssetPicker.jsx`

### 5.1 Overlay and modal container

```js
overlay: {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26,24,20,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 300,
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
  boxShadow: '0 24px 64px rgba(26,24,20,0.16)',
},
```

### 5.2 Modal header

```js
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
},
```

### 5.3 "Todos" / "Partilhados" tabs

```js
toggleBtn: {
  flex: 1,
  padding: '6px 0',
  fontSize: 11,
  fontWeight: 400,
  border: 'none',
  borderBottom: '1.5px solid transparent',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--ink-muted)',
  transition: 'color 0.15s',
},
toggleBtnActive: {
  color: 'var(--ink)',
  borderBottomColor: 'var(--mv-accent)',
  fontWeight: 500,
},
```

### 5.4 Album list

```js
albumBtn: {
  width: '100%',
  padding: '7px 10px',
  background: 'none',
  border: 'none',
  textAlign: 'left',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  fontWeight: 300,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: 'var(--ink-soft)',
  gap: 4,
},
albumBtnActive: {
  background: 'var(--mv-accent-pale)',
  color: 'var(--ink)',
},
albumCount: {
  fontSize: 11,
  color: 'var(--ink-faint)',
  fontWeight: 300,
  flexShrink: 0,
},
```

### 5.5 Footer

```js
footer: {
  padding: '12px 20px',
  borderTop: '0.5px solid var(--border)',
  background: 'var(--paper-warm)',
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  flexShrink: 0,
},
```

"Cancel" button: `btn btn-secondary`
"Confirm (N)" button: `btn btn-primary` (dark ink)

---

## 6. ContributeModal (public viewer upload confirmation)

This modal appears in the public viewer when a guest submits photos/videos. Locate the component — likely `frontend/src/components/viewer/ContributeModal.jsx` or inline in `Viewer.jsx`.

**Do not change the viewer's functional logic — restyle only.**

### 6.1 What is wrong currently

- Generic bright green success icon (`#10b981` or similar) — not in the palette
- "Fechar" button: black with excessive border-radius — Bootstrap aesthetic
- Cold white background with no warmth
- Inter font at normal weights
- File rows on neutral white with no identity

### 6.2 Overlay and container

```js
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
  boxShadow: '0 24px 64px rgba(26,24,20,0.18)',
},
```

### 6.3 Modal header

```js
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
  marginBottom: 6,
},
subtitle: {
  fontSize: 12,
  fontWeight: 300,
  color: 'var(--ink-muted)',
  lineHeight: 1.6,
},
```

### 6.4 Success state — icon and message

Replace the generic bright green checkbox with:

```jsx
{/* Success icon */}
<div style={{
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'var(--success-pale)',
  border: '0.5px solid rgba(90,138,106,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '16px auto 12px',
}}>
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
       stroke="#5a8a6a" strokeWidth="1.5" strokeLinecap="round">
    <polyline points="3,9 7,13 15,5"/>
  </svg>
</div>

{/* Success message */}
<p style={{
  fontFamily: 'var(--font-display)',
  fontSize: 17,
  fontWeight: 400,
  color: 'var(--ink)',
  textAlign: 'center',
  marginBottom: 4,
}}>
  {n} of {total} uploaded successfully
</p>
<p style={{
  fontSize: 12,
  fontWeight: 300,
  color: 'var(--ink-muted)',
  textAlign: 'center',
  marginBottom: 16,
}}>
  They will be reviewed before appearing.
</p>
```

### 6.5 File list rows

```js
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
  background: 'var(--paper-warm)',           /* was white */
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
fileThumbVideo: {               /* placeholder for video files with no thumbnail */
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
/* Per-file check icon: SVG stroke="#5a8a6a" width=14 height=14 */
/* polyline points="2,7 6,11 12,3" strokeWidth=1.5 */
```

### 6.6 Close button

```jsx
<div style={{ padding: '0 16px 16px', textAlign: 'center' }}>
  <button className="btn btn-primary" style={{ minWidth: 100 }} onClick={onClose}>
    Fechar
  </button>
</div>
```

After migration `btn-primary` becomes `background: var(--ink)` — dark and editorial, with `border-radius: var(--radius-sm)` (4px).

### 6.7 Upload progress bar (if the component has an in-progress state)

```js
progressBar: {
  height: 2,
  background: 'var(--paper-deep)',
  borderRadius: 1,
  overflow: 'hidden',
  margin: '8px 0',
},
progressFill: {
  height: '100%',
  background: 'var(--mv-accent)',
  borderRadius: 1,
  transition: 'width 0.3s var(--ease-out)',
},
```

---

## 7. Final notes

- **Do not touch** `Viewer.jsx` or any viewer block components.
- **Do not touch** `frontend/src/lib/themes.js` — viewer themes remain intact.
- After changing `index.css`, grep all editor files for hardcoded `font-family: 'Inter'` — replace with `var(--font-body)`.
- `--accent` now maps to terracotta `#c4795a`. Audit every `var(--accent)` usage in editor files — most will be correct automatically, but any usage where the intent was neutral/black should be replaced with `var(--ink)`.
- The selected block outline in the editor uses `var(--accent)` — it becomes terracotta after this migration. This is intentional and correct.
- `ThemePicker.jsx` and `AlbumImporter.jsx` benefit from the `index.css` token remap automatically, but also review their hardcoded hex values (e.g. `#f0f0f0`, `#1a1a1a` in `AssetPicker.jsx`) and replace with the appropriate CSS variables.
