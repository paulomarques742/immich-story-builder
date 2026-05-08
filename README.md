# Memoire — Immich Story Builder

Transform your [Immich](https://immich.app) photo library into beautiful, shareable narrative stories — with an AI-powered layout engine, a visual block editor, public sharing, community engagement, and optional password protection.

![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2F%20Node.js%20%2F%20SQLite-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### Editor
- **Visual block editor** — drag-and-drop 8 block types to compose your story
- **Smart album import** — groups photos by location, date or theme; auto-generates hero, dividers, grids, and text headers
- **AI layout generation** — Google Gemini 2.0 Flash analyzes your photos and proposes 3 narrative concepts with captions and titles in Portuguese
- **Asset picker** — browse your entire Immich library and add photos or videos directly from the editor
- **Map blocks** — embed interactive OpenStreetMap maps with manual pins or auto-plotted GPS tracks
- **Video blocks** — embed Immich videos with autoplay and loop controls
- **Markdown text blocks** — full markdown with alignment and width options
- **Quote blocks** — styled pull quotes with author attribution
- **5 built-in themes** — Memoire, Sepia, Nordic, Minimal, Warm — each with its own typography and colour palette; fully customizable

### Sharing & Viewer
- **Public viewer** — publish stories at `/<slug>` with no login required
- **Password protection** — optionally lock a story behind a password; viewers get a 24-hour session token on unlock
- **Lightbox** — click any photo to open a full-screen lightbox; navigate with arrow keys; deep-link to any image via `?photo=asset_id`
- **People filter** — filter grid photos by detected faces (powered by Immich people detection)
- **OpenGraph meta tags** — cover image, title and description appear correctly when shared on social media

### Community
- **Public comments** — anonymous commenting on individual photos, with editor moderation
- **Anonymous likes** — fingerprint-based likes; no account required
- **Social feed** — editors see recent activity (comments, likes, rankings) across all their stories
- **Viewer contributions** — visitors can upload their own photos/videos to a story (requires story unlock); editors approve or reject via the dashboard

### Operations
- **Album sync** — three modes: `auto` (inserts new assets automatically), `notify` (alerts editor to review), `manual` (off)
- **In-app notifications** — editors receive alerts for new comments and sync events
- **Server-side media proxy** — thumbnails and video streams are proxied through the backend, keeping the Immich API key hidden from browsers
- **Admin panel** — user management, approval workflow, and global comment moderation
- **Self-hosted** — runs entirely in Docker; SQLite; no external services required beyond Immich (Gemini API key optional)

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

Edit `.env` with your values (see [Environment Variables](#environment-variables) below).

### 3. Start with Docker Compose

```bash
docker compose up -d
```

- **App** → [http://localhost:3000](http://localhost:3000)
- **API** → [http://localhost:3001](http://localhost:3001)

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

Go to `/login` and create an account.

**Option A — Local account**
Click "Criar conta nova" and fill in your name, email and password. The account whose email matches `ADMIN_EMAIL` in `.env` is automatically promoted to `admin`.

**Option B — Immich API key**
Click "Immich API Key", enter your Immich server URL and a valid API key. The app validates it against your Immich instance and creates a local user automatically.

New accounts created by other users require admin approval before they can log in.

---

## Creating a Story

1. Log in → **Dashboard**
2. Click **"+ Nova Story"** → enter a title
3. You're taken to the **Editor**

### Editor layout

```
┌──────────────┬─────────────────────────────────┬──────────────┐
│  Block list  │            Preview               │  Properties  │
│  (sidebar)   │         (live render)            │   (panel)    │
│              │                                  │              │
│  ⠿ hero  1  │  ┌──────────────────────────┐    │  Asset       │
│  ⠿ grid  2  │  │      Hero image          │    │  Caption     │
│  ⠿ text  3  │  └──────────────────────────┘    │  Height      │
│  ⠿ map   4  │  ┌────┬────┬────┐               │  Overlay     │
│              │  │    │    │    │               │              │
│ + Add block  │  └────┴────┴───┘               │              │
└──────────────┴─────────────────────────────────┴──────────────┘
```

### Importing an album

1. Click **"↓ Importar álbum"** in the top bar
2. Select one or more Immich albums
3. Click **Importar**

The importer analyses your photos and automatically builds a layout:
- **Location-based** layout if photos span multiple cities or GPS points more than 50 km apart
- **Day-by-day** layout if photos span 3 or more calendar days
- **Theme-based** layout (fallback) grouping by subject/mood

Each layout inserts a **Hero** cover, section **Dividers**, **Text** headers, and **Grid** blocks — with featured photos (marked as favourite in Immich or rated ≥ 4) placed prominently.

### AI Layout (optional — requires Gemini API key)

1. Open the album importer and click **"Sugestões IA"**
2. Gemini analyses your photos (quality, mood, subject, GPS)
3. Three narrative concepts are presented — pick one
4. The story is rebuilt with AI-generated captions and titles in Portuguese

### Publishing

Click **"Publicar"** → the story is live at `/<slug>`. Use **"Ver público ↗"** to preview it.

---

## Block Reference

### Block types

| Type | Description |
|---|---|
| `hero` | Full-width cover image with optional title/caption overlay |
| `grid` | Photo grid — 1–6 columns, configurable gap and aspect ratio |
| `text` | Markdown content with alignment and max-width options |
| `quote` | Pull quote with optional author attribution |
| `map` | Interactive OpenStreetMap — manual pin or auto GPS from assets |
| `video` | Immich video with autoplay/loop controls |
| `divider` | Section separator — line style or labelled (auto-generated on import) |
| `spacer` | Vertical whitespace |

### Hero block

| Property | Values | Description |
|---|---|---|
| `asset_id` | Immich asset ID | The cover photo |
| `title` | string | Large overlay title |
| `caption` | string | Subtitle / caption text |
| `height` | `full` / `half` / `medium` | 100 vh / 50 vh / 340 px |
| `overlay` | boolean | Gradient behind text |

### Grid block

| Property | Values | Description |
|---|---|---|
| `asset_ids` | array | Immich asset IDs |
| `columns` | 1–6 | Column count |
| `gap` | `sm` / `md` / `lg` | Photo spacing |
| `aspect` | `square` / `landscape` / `portrait` | Aspect ratio |

### Text block

| Property | Values | Description |
|---|---|---|
| `markdown` | string | Markdown content |
| `align` | `left` / `center` / `right` | Text alignment |
| `max_width` | `narrow` / `prose` / `wide` | Content width |

### Map block

| Property | Values | Description |
|---|---|---|
| `mode` | `manual` / `auto` | Manual pin vs GPS-from-assets |
| `lat` / `lng` | float | Centre point (manual mode) |
| `label` | string | Pin label (manual mode) |
| `asset_ids` | array | Assets whose GPS is plotted (auto mode) |
| `show_route` | boolean | Draw polyline between points |

---

## Themes

| Theme | Palette | Fonts |
|---|---|---|
| **Memoire** (default) | Warm terracotta | Cormorant Garamond + DM Sans |
| **Sepia** | Aged brown | Playfair Display + Lato |
| **Nordic** | Cool blue-grey | Montserrat |
| **Minimal** | Black & white | Inter |
| **Warm** | Golden amber | Georgia + Raleway |

All theme colours (ink, paper, accent) can be overridden per story with custom CSS variables.

---

## API Overview

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Email + password login |
| `POST` | `/api/auth/register` | Create local account |
| `POST` | `/api/auth/immich` | Login with Immich API key |
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/admin/users` | List all users (admin) |
| `POST` | `/api/auth/admin/users/:id/approve` | Approve pending user (admin) |
| `DELETE` | `/api/auth/admin/users/:id` | Delete user (admin) |

### Stories & Blocks

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stories` | List stories |
| `POST` | `/api/stories` | Create story |
| `GET` | `/api/stories/:id` | Get story + blocks |
| `PUT` | `/api/stories/:id` | Update metadata |
| `DELETE` | `/api/stories/:id` | Delete story |
| `POST` | `/api/stories/:id/publish` | Toggle publish |
| `POST` | `/api/stories/:id/password` | Set/clear password |
| `POST` | `/api/stories/:id/blocks` | Add block |
| `PUT` | `/api/stories/:id/blocks/:bid` | Update block |
| `DELETE` | `/api/stories/:id/blocks/:bid` | Delete block |
| `POST` | `/api/stories/:id/blocks/reorder` | Reorder blocks |
| `POST` | `/api/stories/:id/blocks/import-album` | Smart album import |
| `POST` | `/api/stories/:id/blocks/ai-suggestions` | Request AI layout suggestions |
| `POST` | `/api/stories/:id/blocks/ai-apply` | Apply selected AI suggestion |
| `GET` | `/api/jobs/:jobId` | Poll AI job status |

### Public Viewer

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/:slug` | Story data (no auth) |
| `POST` | `/api/public/:slug/unlock` | Unlock password-protected story |
| `GET` | `/api/public/:slug/assets/:id/thumb` | Proxied thumbnail |
| `GET` | `/api/public/:slug/assets/:id/original` | Proxied video (Range supported) |
| `GET` | `/api/public/:slug/people` | People detected in story |
| `GET` | `/api/public/:slug/people/:personId/assets` | Assets for a person |
| `GET` | `/api/public/:slug/comments/:assetId` | Approved comments on a photo |
| `POST` | `/api/public/:slug/comments/:assetId` | Submit comment |
| `POST` | `/api/public/:slug/likes/:assetId` | Toggle like |
| `GET` | `/api/public/:slug/counts` | Like + comment counts |
| `POST` | `/api/public/:slug/contributions` | Upload photo/video (multipart) |

### Social & Notifications

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/social/feed` | Recent comments across your stories |
| `GET` | `/api/social/assets` | Assets with engagement by story |
| `GET` | `/api/social/ranking` | Top 30 assets by likes |
| `GET` | `/api/notifications` | In-app notifications |
| `POST` | `/api/notifications/read-all` | Mark all notifications read |

### Immich

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/immich/albums` | List accessible albums |
| `GET` | `/api/immich/assets/:id/thumb` | Authenticated thumbnail |

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `JWT_SECRET` | Long random string for signing tokens (min 32 chars) |
| `IMMICH_URL` | Internal URL of your Immich instance |
| `IMMICH_API_KEY` | Immich read-only API key |
| `ADMIN_EMAIL` | Email auto-promoted to `admin` on first registration |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend port |
| `DATABASE_PATH` | `./data/db.sqlite` | SQLite file path |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `PUBLIC_URL` | *(inferred)* | Base URL for OpenGraph links |
| `SYNC_INTERVAL_MINUTES` | `60` | Album sync frequency |
| `GEMINI_API_KEY` | — | Google AI Studio key (required for AI Layout) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model ID |
| `AI_BATCH_SIZE` | `10` | Photos per batch in AI analysis |
| `AI_CONCURRENCY` | `3` | Parallel Gemini batches |
| `IMMICH_CONTRIBUTIONS_ALBUM` | `Memoire` | Immich album for viewer uploads |
| `CONTRIBUTION_MAX_SIZE_MB` | `200` | File size limit for viewer uploads |
| `IMPORT_BURST_THRESHOLD_SECONDS` | `45` | Photos within N seconds are grouped as a burst |
| `IMPORT_GPS_PROXIMITY_METERS` | `200` | GPS clustering radius |
| `IMPORT_VIDEO_LONG_SECONDS` | `10` | Videos longer than N seconds get their own block |
| `IMPORT_FEATURED_MIN_RATING` | `4` | Minimum EXIF rating to mark a photo as featured |
| `VITE_API_URL` | `http://localhost:3001` | API base URL for frontend build |
| `VITE_IMMICH_URL` | *(IMMICH_URL)* | Immich URL for frontend direct links |

---

## Cloudflare Tunnel

The frontend (`port 3000`) is the public entry point. Expose it via Cloudflare Tunnel or your reverse proxy of choice. The backend (`port 3001`) can remain on the internal network — all Immich communication happens server-side.

---

## Roadmap

- [x] **Phase 1** — Auth, story/block CRUD, basic public viewer (hero, grid, text)
- [x] **Phase 2** — Drag-and-drop editor, asset picker, album auto-import, markdown editor
- [x] **Phase 3** — Map blocks, video blocks, album sync, password protection, public comments
- [x] **Phase 4** — AI layout (Gemini), anonymous likes, viewer contributions, people filter, in-app notifications, social feed, 5 themes, OpenGraph meta tags

---

## License

MIT
