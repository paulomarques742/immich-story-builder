# Memoire — Tailwind CSS Migration

> **Scope:** Frontend only. Backend untouched. Viewer (`Viewer.jsx` + all `components/viewer/` + all `components/blocks/`) untouched.
> **Goal:** Replace all inline `style={{ }}` objects in editor/dashboard/login components with Tailwind utility classes, backed by a single design token config.
> **Stack:** React 18 + Vite 5 — use the native `@tailwindcss/vite` plugin (no PostCSS config needed).

---

## 1. Install

```bash
cd frontend
npm install tailwindcss @tailwindcss/vite
```

---

## 2. `frontend/vite.config.js` — add the plugin

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 3. `frontend/src/index.css` — add Tailwind import at the top

Add this as the very first line, before any existing CSS:

```css
@import "tailwindcss";
```

Keep everything else in `index.css` exactly as-is. The viewer CSS variables, viewer block styles, Leaflet overrides — all stay. Tailwind layers sit alongside them without conflict.

---

## 4. `frontend/tailwind.config.js` — design token map

Create this file at `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],

  // Viewer pages use CSS variables directly — no purging their classes
  // Editor/dashboard components use Tailwind classes defined here

  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1814',
          soft:    '#3d3a35',
          muted:   '#7a756d',
          faint:   '#b8b2a8',
        },
        paper: {
          DEFAULT: '#faf8f5',
          warm:    '#f4f0ea',
          deep:    '#ede8e0',
        },
        accent: {
          DEFAULT: '#c4795a',
          soft:    '#d9957a',
          pale:    '#f2e4dc',
        },
        success: {
          DEFAULT: '#5a8a6a',
          pale:    '#e8f2ec',
        },
        danger: {
          DEFAULT: '#b05050',
          hover:   '#8f3f3f',
        },
        border: {
          DEFAULT: '#e8e2d8',
          strong:  '#d4cec4',
        },
      },

      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },

      fontWeight: {
        light:   '300',
        normal:  '400',
        medium:  '500',
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
        xs:    ['11px', { lineHeight: '1.5' }],
        sm:    ['12px', { lineHeight: '1.6' }],
        base:  ['13px', { lineHeight: '1.6' }],
        md:    ['14px', { lineHeight: '1.5' }],
        lg:    ['15px', { lineHeight: '1.4' }],
        xl:    ['17px', { lineHeight: '1.3' }],
        '2xl': ['20px', { lineHeight: '1.25' }],
        '3xl': ['26px', { lineHeight: '1.2' }],
        '4xl': ['32px', { lineHeight: '1.15' }],
      },

      borderRadius: {
        none: '0',
        xs:   '2px',
        sm:   '4px',
        DEFAULT: '6px',
        lg:   '8px',
        xl:   '12px',
        full: '9999px',
      },

      boxShadow: {
        xs: '0 1px 3px rgba(26,24,20,0.07)',
        sm: '0 2px 8px rgba(26,24,20,0.09)',
        md: '0 8px 24px rgba(26,24,20,0.10)',
        lg: '0 24px 64px rgba(26,24,20,0.14)',
      },

      transitionTimingFunction: {
        'ease-editorial': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      height: {
        navbar: '50px',
        toolbar: '44px',
      },

      maxWidth: {
        prose: '65ch',
        story: '900px',
        modal: '560px',
        picker: '960px',
      },
    },
  },

  plugins: [],
};
```

---

## 5. `frontend/src/index.css` — add shared component classes

After the `@import "tailwindcss"` line and before the existing CSS, add this block of reusable component classes. This is the single source of truth for buttons, badges, inputs, and form fields used across all editor/dashboard components.

```css
/* ── Buttons ─────────────────────────────────────────────────── */
.btn {
  @apply inline-flex items-center gap-1.5 px-3.5 py-1.5
         font-body text-sm font-normal rounded-sm border
         cursor-pointer transition-all duration-150 whitespace-nowrap select-none;
}

.btn-primary {
  @apply bg-ink text-paper border-ink
         hover:bg-ink-soft hover:border-ink-soft;
}

.btn-accent {
  @apply bg-accent text-white border-accent
         hover:bg-accent-soft hover:border-accent-soft
         hover:shadow-sm;
}

.btn-secondary {
  @apply bg-paper-warm text-ink-soft border-border
         hover:bg-paper-deep hover:border-border-strong hover:text-ink;
}

.btn-ghost {
  @apply bg-transparent text-ink-muted border-transparent
         hover:bg-paper-warm hover:text-ink;
}

.btn-danger {
  @apply bg-transparent text-danger border-danger/30
         hover:bg-danger/7;
}

.btn-sm {
  @apply px-2.5 py-1 text-xs;
}

.btn-icon {
  @apply w-7 h-7 p-0 justify-center
         bg-paper-warm border-border text-ink-muted rounded-xs
         hover:bg-paper-deep hover:text-ink;
}

/* ── Badges ──────────────────────────────────────────────────── */
.badge {
  @apply inline-flex items-center px-2 py-0.5
         font-body text-2xs font-normal rounded-xs
         tracking-wider leading-snug;
}

.badge-published {
  @apply bg-success-pale text-success border border-success/20;
}

.badge-draft {
  @apply bg-paper/90 text-ink-muted border border-ink/10
         backdrop-blur-sm;
}

.badge-new {
  @apply bg-accent-pale text-accent border border-accent/20;
}

/* ── Form fields ─────────────────────────────────────────────── */
.field-label {
  @apply block font-body text-2xs font-medium text-ink-muted
         uppercase tracking-widest mb-1;
}

.field-input {
  @apply w-full px-2.5 py-1.5 font-body text-sm font-light
         bg-paper-warm text-ink-soft
         border border-border rounded-xs
         outline-none transition-all duration-100
         placeholder:text-ink-faint
         focus:border-border-strong focus:shadow-[0_0_0_2px_rgba(196,121,90,0.15)];
}

.field-select {
  @apply field-input appearance-none cursor-pointer;
}

.field-textarea {
  @apply field-input resize-y min-h-[72px] leading-relaxed;
}

/* ── Sidebar (dark) ──────────────────────────────────────────── */
.sidebar-item {
  @apply flex items-center justify-between
         px-3.5 py-1.5 text-xs font-light
         text-ink-faint/70 border-l-2 border-transparent
         cursor-pointer transition-all duration-100
         hover:bg-white/5;
}

.sidebar-item-active {
  @apply bg-accent/10 border-l-accent text-paper/90 pl-3;
}

/* ── Sync notification badge ─────────────────────────────────── */
.sync-badge {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1
         font-body text-xs font-normal
         bg-accent/10 text-accent border border-accent/25
         rounded-xs cursor-pointer;
}
```

---

## 6. Files to migrate — scope

Only migrate these files. Everything else is untouched.

```
frontend/src/pages/Login.jsx
frontend/src/pages/Dashboard.jsx
frontend/src/pages/Editor.jsx
frontend/src/components/editor/BlockEditor.jsx
frontend/src/components/editor/BlockToolbar.jsx
frontend/src/components/editor/SortableBlockList.jsx
frontend/src/components/editor/AlbumImporter.jsx
frontend/src/components/editor/AssetPicker.jsx        (or equivalent modal)
frontend/src/components/editor/ThemePicker.jsx
frontend/src/components/editor/StorySettingsModal.jsx
frontend/src/components/editor/AiLayoutButton.jsx
frontend/src/components/editor/AiProgressModal.jsx
```

**Do NOT touch:**
```
frontend/src/pages/Viewer.jsx
frontend/src/components/viewer/*
frontend/src/components/blocks/*
frontend/src/lib/*
```

---

## 7. Migration pattern — how to convert each component

For each file in scope, follow this exact process:

### Step 1 — Delete the `const s = { ... }` style object at the bottom of the file

### Step 2 — Replace `style={s.foo}` with `className="..."`

### Step 3 — For any remaining one-off inline styles (dynamic values like widths from state), keep them as `style={{ }}` — only static presentational styles move to Tailwind

### Step 4 — For hover/focus states that were handled with `onMouseEnter`/`onMouseLeave`, delete those handlers and use Tailwind `hover:` / `focus:` variants instead

---

## 8. `frontend/src/pages/Dashboard.jsx` — target markup

```jsx
{/* Navbar */}
<header className="bg-ink sticky top-0 z-10 h-navbar flex items-center justify-between px-8">

  {/* Logo */}
  <div className="flex items-center gap-2.5">
    <svg width="22" height="22" viewBox="0 0 20 20" fill="#faf8f5">
      <rect x="2" y="2" width="7" height="10" rx="0.5"/>
      <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
      <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
      <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
    </svg>
    <span className="font-display text-xl font-normal tracking-wide text-paper">
      Memoire
    </span>
  </div>

  {/* Right side */}
  <div className="flex items-center gap-4">
    <span className="text-xs font-light text-ink-faint">{user.email}</span>
    <button className="btn btn-ghost text-ink-faint hover:text-paper">Utilizadores</button>
    <button className="btn btn-ghost text-ink-faint hover:text-paper" onClick={logout}>Sair</button>
    <button className="btn btn-accent" onClick={createStory}>+ Nova Story</button>
  </div>

</header>

{/* Page body */}
<main className="max-w-[1120px] mx-auto px-8 py-10">

  {/* Title row */}
  <div className="flex items-baseline gap-2.5 mb-7">
    <h1 className="font-display text-3xl font-normal text-ink tracking-tight">
      As tuas stories
    </h1>
    <span className="text-xs font-light text-ink-muted tracking-wider">
      {stories.length} stories
    </span>
  </div>

  {/* Grid */}
  <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
    {stories.map(story => (
      <div key={story.id}
        className="bg-white border border-border rounded cursor-pointer
                   transition-all duration-200
                   hover:-translate-y-0.5 hover:shadow-md"
        onClick={() => navigate(`/editor/${story.id}`)}
      >
        {/* Thumbnail */}
        <div className="relative h-40 bg-paper-warm overflow-hidden">
          {story.cover_asset_id
            ? <img src={thumbUrl(story.cover_asset_id)} className="w-full h-full object-cover"/>
            : <div className="w-full h-full bg-gradient-to-br from-paper-warm to-paper-deep"/>
          }
          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span className={`badge ${story.published ? 'badge-published' : 'badge-draft'}`}>
              {story.published ? 'Publicado' : 'Rascunho'}
            </span>
            {story.new_assets_count > 0 && (
              <span className="badge badge-new">{story.new_assets_count} nova{story.new_assets_count > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="px-3.5 py-3">
          <p className="text-md font-normal text-ink mb-1.5 truncate">{story.title}</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-ink-faint">/{story.slug}</span>
            <div className="flex gap-1">
              <button className="btn btn-icon btn-sm"
                onClick={(e) => { e.stopPropagation(); openSettings(story); }}>
                <SettingsIcon/>
              </button>
              <button className="btn btn-icon btn-sm"
                onClick={(e) => { e.stopPropagation(); deleteStory(story.id); }}>
                <TrashIcon/>
              </button>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>

</main>
```

---

## 9. `frontend/src/pages/Editor.jsx` — target markup (key sections)

```jsx
{/* Top toolbar */}
<header className="bg-paper border-b border-border h-toolbar flex items-center gap-2 px-3 shrink-0 z-10">

  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
    ← Dashboard
  </button>

  <span className="text-ink-faint text-xs">·</span>
  <span className="font-display text-lg font-normal text-ink tracking-wide truncate max-w-[200px]">
    {story.title}
  </span>

  {/* Spacer */}
  <div className="flex-1"/>

  {/* Sync badge */}
  {newAssetsCount > 0 && (
    <div className="sync-badge" onClick={handleSync}>
      <span className="w-1.5 h-1.5 rounded-full bg-accent"/>
      {newAssetsCount} new photos
      <button className="ml-1 text-accent-soft hover:text-accent" onClick={(e) => { e.stopPropagation(); dismissSync(); }}>✕</button>
    </div>
  )}

  <button className="btn btn-secondary btn-sm"><AlbumIcon/> Importar álbum</button>
  <button className="btn btn-secondary btn-sm"><SparkleIcon/> AI Layout</button>
  <ThemePicker/>

  <button
    className={`btn btn-sm ${story.published ? 'btn-secondary' : 'btn-accent'}`}
    onClick={togglePublish}
  >
    {story.published ? 'Publicado' : 'Publicar'}
  </button>
  {story.published && (
    <button className="btn btn-ghost btn-sm text-ink-faint" onClick={togglePublish}>
      Despublicar
    </button>
  )}

</header>

{/* Left sidebar */}
<aside className="bg-ink flex flex-col overflow-x-hidden shrink-0 transition-[width] duration-200"
       style={{ width: leftOpen ? 192 : 40 }}>

  {leftOpen ? (
    <>
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5 border-b border-white/7 shrink-0">
        <div>
          <p className="text-2xs font-medium text-ink-faint/40 uppercase tracking-widest mb-1">
            Blocos
          </p>
          <p className="font-display text-base font-normal text-paper truncate">
            {story.title}
          </p>
        </div>
        <button className="btn btn-ghost text-ink-faint hover:text-paper p-1"
                onClick={() => setLeftOpen(false)}>‹</button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <SortableBlockList blocks={blocks} selected={selected} onSelect={selectBlock} onReorder={handleReorder}/>
      </div>
    </>
  ) : (
    <div className="flex flex-col items-center py-2">
      <button className="btn btn-ghost text-ink-faint hover:text-paper p-1"
              onClick={() => setLeftOpen(true)}>›</button>
    </div>
  )}
</aside>

{/* Right properties panel */}
<aside className="bg-paper border-l border-border overflow-y-auto shrink-0 transition-[width] duration-200"
       style={{ width: rightOpen ? 220 : 0 }}>
  {rightOpen && selectedBlock && (
    <div className="p-3.5">
      <BlockEditor block={selectedBlock} onChange={handleBlockChange}/>
    </div>
  )}
</aside>
```

---

## 10. `frontend/src/components/editor/BlockEditor.jsx` — target markup pattern

```jsx
{/* Section heading */}
<h3 className="font-display text-lg font-normal text-ink tracking-wide mb-3">
  {blockTypeLabel}
</h3>

{/* Field wrapper */}
<div className="flex flex-col gap-1 mb-3">
  <label className="field-label">Imagem</label>
  <div className="flex gap-1.5">
    <input className="field-input flex-1" value={content.asset_id || ''} readOnly/>
    <button className="btn btn-secondary btn-sm" onClick={openPicker}>
      <ImageIcon/>
    </button>
  </div>
  {content.asset_id && (
    <img src={thumbUrl(content.asset_id)} className="w-full aspect-video object-cover rounded-xs mt-1 border border-border"/>
  )}
</div>

<div className="flex flex-col gap-1 mb-3">
  <label className="field-label">Título</label>
  <input className="field-input" value={content.title || ''} onChange={(e) => update('title', e.target.value)} placeholder="Título opcional"/>
</div>

<div className="flex flex-col gap-1 mb-3">
  <label className="field-label">Caption</label>
  <input className="field-input" value={content.caption || ''} onChange={(e) => update('caption', e.target.value)} placeholder="Subtítulo / legenda opcional"/>
</div>

<div className="flex flex-col gap-1 mb-3">
  <label className="field-label">Altura</label>
  <select className="field-select" value={content.height || 'full'} onChange={(e) => update('height', e.target.value)}>
    <option value="full">Full (100vh)</option>
    <option value="large">Large (75vh)</option>
    <option value="medium">Medium (50vh)</option>
  </select>
</div>

<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" checked={content.overlay ?? true} onChange={(e) => update('overlay', e.target.checked)}
         className="accent-accent"/>
  <span className="text-sm font-light text-ink-soft">Gradiente por cima</span>
</label>
```

---

## 11. `frontend/src/components/editor/SortableBlockList.jsx` — target markup

```jsx
{blocks.map((block, i) => (
  <div key={block.id}
    className={`sidebar-item ${selected === block.id ? 'sidebar-item-active' : ''}`}
    onClick={() => onSelect(block.id)}
  >
    <span className="flex items-center gap-2">
      <span className="text-base leading-none">{BLOCK_ICONS[block.type]}</span>
      <span>{block.type}</span>
    </span>
    <span className={`text-2xs tabular-nums ${selected === block.id ? 'text-accent-soft' : 'text-ink-faint/35'}`}>
      {i + 1}
    </span>
  </div>
))}
```

---

## 12. AssetPicker modal — target markup

```jsx
{/* Overlay */}
<div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-[300] backdrop-blur-sm">

  {/* Modal */}
  <div className="bg-paper border border-border rounded-lg shadow-lg
                  w-[88vw] max-w-picker h-[82vh] flex flex-col overflow-hidden">

    {/* Header */}
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
      <h2 className="font-display text-2xl font-normal text-ink">Seleccionar fotos</h2>
      <button className="btn btn-ghost btn-sm text-ink-faint" onClick={onClose}>✕</button>
    </div>

    <div className="flex flex-1 overflow-hidden">

      {/* Album list sidebar */}
      <div className="w-48 border-r border-border bg-paper-warm flex flex-col shrink-0 overflow-y-auto">
        <div className="flex gap-1 p-2 border-b border-border">
          <button className={`btn btn-sm flex-1 ${tab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTab('all')}>Todos</button>
          <button className={`btn btn-sm flex-1 ${tab === 'shared' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setTab('shared')}>Partilhados</button>
        </div>
        <div className="p-2 border-b border-border">
          <input className="field-input text-xs" placeholder="Pesquisar álbuns..." value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
          {albums.map(album => (
            <button key={album.id}
              className={`w-full flex justify-between items-center gap-1 px-2 py-1.5
                          text-xs font-light text-ink-soft rounded-xs text-left
                          transition-colors duration-100
                          ${selectedAlbum === album.id ? 'bg-accent-pale text-ink' : 'hover:bg-paper-deep'}`}
              onClick={() => setSelectedAlbum(album.id)}
            >
              <span className="truncate">{album.albumName}</span>
              <span className="text-ink-faint shrink-0">{album.assetCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-3 bg-paper">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {assets.map(asset => (
            <div key={asset.id}
              className={`relative aspect-square overflow-hidden rounded-xs cursor-pointer
                          border-2 transition-all duration-100
                          ${selected.includes(asset.id) ? 'border-accent' : 'border-transparent hover:border-border-strong'}`}
              onClick={() => toggleAsset(asset.id)}
            >
              <img src={thumbUrl(asset.id, 'thumbnail')} className="w-full h-full object-cover"/>
              {selected.includes(asset.id) && (
                <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-paper-warm shrink-0">
      <span className="text-xs font-light text-ink-muted">{selected.length} seleccionadas</span>
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onConfirm(selected)}>Confirmar ({selected.length})</button>
      </div>
    </div>

  </div>
</div>
```

---

## 13. `frontend/src/pages/Login.jsx` — target markup

```jsx
<div className="min-h-screen bg-paper flex items-center justify-center">
  <div className="w-full max-w-sm mx-4">

    {/* Logo */}
    <div className="flex items-center justify-center gap-2.5 mb-10">
      <svg width="28" height="28" viewBox="0 0 20 20" fill="#1a1814">
        <rect x="2" y="2" width="7" height="10" rx="0.5"/>
        <rect x="11" y="2" width="7" height="6" rx="0.5" opacity="0.55"/>
        <rect x="11" y="10" width="7" height="8" rx="0.5" opacity="0.35"/>
        <rect x="2" y="14" width="7" height="4" rx="0.5" opacity="0.25"/>
      </svg>
      <span className="font-display text-3xl font-normal text-ink tracking-wide">Memoire</span>
    </div>

    {/* Card */}
    <div className="bg-white border border-border rounded-lg p-8 shadow-sm">
      <h2 className="font-display text-2xl font-normal text-ink mb-6 text-center">Entrar</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="field-label">Email</label>
          <input className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}/>
        </div>
        <div>
          <label className="field-label">Password</label>
          <input className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button className="btn btn-primary w-full justify-center mt-1" onClick={handleLogin}>
          {loading ? '…' : 'Entrar'}
        </button>
      </div>
    </div>

  </div>
</div>
```

---

## 14. Final checks

After migration, run:

```bash
cd frontend && npm run dev
```

Verify:
- [ ] Dashboard renders with warm `bg-paper-warm` background
- [ ] Navbar is dark `bg-ink` with legible `text-paper` logo
- [ ] Card titles are `text-ink` (dark), not accent colour
- [ ] "Rascunho" badge is readable on any thumbnail (uses `backdrop-blur`)
- [ ] Editor left sidebar is dark `bg-ink` with `sidebar-item-active` terracotta indicator
- [ ] Editor right panel is `bg-paper` (light)
- [ ] All inputs show terracotta focus ring (not blue)
- [ ] Hover states on cards, buttons, album list work via CSS (no JS handlers)
- [ ] Viewer pages (`/:slug`) are completely unchanged
