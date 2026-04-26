# Immich Story Builder

Transform your [Immich](https://immich.app) photo albums into beautiful, interactive narrative timelines — with a visual block editor, public sharing, and optional password protection.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2F%20Node.js%20%2F%20SQLite-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Visual block editor** — drag-and-drop blocks (Hero, Grid, Text, Divider) to compose your story
- **One-click album import** — automatically generates a hero, monthly dividers, and photo grids from any Immich album
- **Asset picker** — browse your Immich library and pick photos directly from the editor
- **Markdown text blocks** — rich markdown editor with live preview
- **Public viewer** — share stories via a custom slug URL (`/your-slug`)
- **Two auth modes** — local email/password or Immich API key login
- **Self-hosted** — runs entirely in Docker; no cloud services required

---

## Quick Start (Docker)

### 1. Clone the repository

```bash
git clone https://github.com/paulomarques742/immich-story-builder.git
cd immich-story-builder
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

```env
JWT_SECRET=change_this_to_a_long_random_string
IMMICH_URL=https://your-immich-instance.com
ADMIN_EMAIL=your@email.com
```

### 3. Start with Docker Compose

```bash
docker compose up -d
```

- **Frontend** → [http://localhost:3000](http://localhost:3000)
- **Backend API** → [http://localhost:3001](http://localhost:3001)

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+

### Backend

```bash
cd backend
npm install
cp ../.env.example .env   # edit with your values
node src/index.js
# Running on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:3001` automatically.

---

## First Login

On first visit, go to `/login` and create an account.

**Two options:**

**Option A — Local account**
Click "Criar conta nova", fill in name, email and password. The first account whose email matches `ADMIN_EMAIL` in `.env` gets the `admin` role.

**Option B — Immich API key**
Click "Immich API Key", enter your Immich server URL and a valid API key. The app validates it against your Immich instance and creates a local user automatically.

---

## Creating a Story

1. Log in → you land on the **Dashboard**
2. Click **"+ Nova Story"** → give it a title
3. You're taken to the **Editor**

### Editor layout

```
┌──────────────┬───────────────────────────────┬──────────────┐
│  Block list  │          Preview              │  Properties  │
│  (sidebar)   │       (live render)           │   (panel)    │
│              │                               │              │
│  ⠿ hero  1  │  ┌─────────────────────────┐  │  Asset ID    │
│  ⠿ grid  2  │  │     Hero image          │  │  Caption     │
│  ⠿ text  3  │  └─────────────────────────┘  │  Height      │
│              │  ┌────┬────┬────┐            │  Overlay     │
│ + Add block  │  │    │    │    │            │              │
└──────────────┴──┴────┴────┴───┴────────────┴──────────────┘
```

### Importing an album

1. Click **"↓ Importar álbum"** in the top bar
2. Select one or more Immich albums
3. Click **Importar** — blocks are created automatically:
   - **Hero** block for the first photo
   - **Divider** blocks between months (e.g. "2024 · Agosto")
   - **Grid** blocks (3 columns) for all remaining photos

### Block types

| Type | Description |
|---|---|
| `hero` | Full-width cover image with optional caption overlay |
| `grid` | Photo grid with configurable columns (1–4), gap, and aspect ratio |
| `text` | Markdown content with alignment and max-width options |
| `divider` | Visual separator with optional label (auto-generated on import) |

### Publishing

Click **"Publicar"** in the top bar. The story becomes accessible at `/<slug>` without any login. Click **"Ver público ↗"** to open the viewer.

---

## Block Editor Reference

### Hero block

| Property | Values | Description |
|---|---|---|
| `asset_id` | Immich asset ID | The cover image |
| `caption` | string | Optional caption text |
| `height` | `full` / `half` / `medium` | Image height (100vh / 50vh / 340px) |
| `overlay` | boolean | Show gradient behind caption |

### Grid block

| Property | Values | Description |
|---|---|---|
| `asset_ids` | array | List of Immich asset IDs |
| `columns` | 1–4 | Number of columns |
| `gap` | `sm` / `md` / `lg` | Spacing between photos |
| `aspect` | `square` / `landscape` / `portrait` | Photo aspect ratio |

### Text block

| Property | Values | Description |
|---|---|---|
| `markdown` | string | Markdown content |
| `align` | `left` / `center` / `right` | Text alignment |
| `max_width` | `narrow` / `prose` / `wide` | Max content width |

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Local login |
| `POST` | `/api/auth/register` | Create local account |
| `POST` | `/api/auth/immich` | Login with Immich API key |
| `GET` | `/api/stories` | List your stories |
| `POST` | `/api/stories` | Create a story |
| `PUT` | `/api/stories/:id` | Update story metadata |
| `POST` | `/api/stories/:id/publish` | Toggle publish |
| `GET` | `/api/stories/:id/blocks` | List blocks |
| `POST` | `/api/stories/:id/blocks` | Add a block |
| `PUT` | `/api/stories/:id/blocks/:bid` | Update a block |
| `POST` | `/api/stories/:id/blocks/reorder` | Reorder blocks |
| `POST` | `/api/stories/:id/blocks/import-album` | Auto-import from Immich album |
| `GET` | `/api/immich/albums` | List accessible albums |
| `GET` | `/api/immich/assets/:id/thumb` | Proxied thumbnail |
| `GET` | `/api/public/:slug` | Public story (no auth) |

---

## CasaOS / Cloudflare Tunnel

The frontend (`port 3000`) is the public entry point. Expose it via Cloudflare Tunnel or your reverse proxy of choice. The backend (`port 3001`) can remain internal.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✓ | Long random string for signing tokens |
| `IMMICH_URL` | ✓ | Base URL of your Immich instance |
| `ADMIN_EMAIL` | ✓ | Email that receives the `admin` role on first registration |
| `DATABASE_PATH` | — | SQLite file path (default: `/data/db.sqlite`) |
| `SYNC_INTERVAL_MINUTES` | — | Album sync interval (default: `15`) |
| `PORT` | — | Backend port (default: `3001`) |
| `VITE_API_URL` | — | API base URL seen by the frontend build |
| `VITE_IMMICH_URL` | — | Immich URL used for direct image links |

---

## Roadmap

- [x] **Phase 1** — Auth, story/block CRUD, basic public viewer (hero, grid, text)
- [x] **Phase 2** — Drag-and-drop editor, asset picker, album auto-import, markdown editor
- [ ] **Phase 3** — Map blocks (Leaflet/OpenStreetMap), video blocks, Immich sync notifications, story password protection, public comments
- [ ] **Phase 4** — OpenGraph meta tags, custom slugs, mobile-responsive, dark mode viewer

---

## License

MIT
