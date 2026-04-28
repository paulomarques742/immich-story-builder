# Immich Story Builder — Project Specification

## Visão Geral

Aplicação web selfhosted que transforma álbuns do Immich em **timelines narrativas interactivas** — com blocos de conteúdo editáveis, mapas, comentários e partilha pública com link personalizado.

Stack: **React + Vite** (frontend) · **Node.js + Express** (backend) · **SQLite** (base de dados) · **Docker Compose** (deployment)

---

## Arquitectura

```
immich-story-builder/
├── frontend/                  # React + Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx      # lista de stories
│   │   │   ├── Editor.jsx         # editor de story
│   │   │   └── Viewer.jsx         # viewer público (rota /:slug)
│   │   ├── components/
│   │   │   ├── blocks/            # Hero, Grid, Text, Map, Video
│   │   │   ├── editor/            # BlockToolbar, BlockEditor, DragHandle
│   │   │   └── viewer/            # ViewerBlock, CommentSection, StoryNav
│   │   └── lib/
│   │       ├── api.js             # cliente para o backend
│   │       └── immich.js          # wrapper para Immich API
│
├── backend/                   # Node.js + Express
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── stories.js
│   │   │   ├── blocks.js
│   │   │   ├── comments.js
│   │   │   └── immich.js          # proxy/sync com Immich
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   └── index.js           # better-sqlite3
│   │   └── middleware/
│   │       ├── auth.js
│   │       └── storyAccess.js     # verifica password de story
│
├── docker-compose.yml
└── .env.example
```

---

## Base de Dados (SQLite)

```sql
-- Utilizadores (sincronizados ou criados localmente)
CREATE TABLE users (
  id          TEXT PRIMARY KEY,        -- pode ser o ID do Immich
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password_hash TEXT,                  -- NULL se auth via Immich
  immich_token TEXT,                   -- API key do Immich deste user
  role        TEXT DEFAULT 'editor',   -- 'admin' | 'editor'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stories
CREATE TABLE stories (
  id          TEXT PRIMARY KEY,        -- UUID
  slug        TEXT UNIQUE NOT NULL,    -- URL personalizado, ex: "ferias-2024"
  title       TEXT NOT NULL,
  description TEXT,
  cover_asset_id TEXT,                 -- asset_id do Immich para capa
  password_hash TEXT,                  -- NULL = sem protecção
  immich_album_ids TEXT NOT NULL,      -- JSON array de album IDs
  sync_mode   TEXT DEFAULT 'notify',  -- 'auto' | 'notify' | 'manual'
  published   INTEGER DEFAULT 0,       -- 0 = rascunho, 1 = publicado
  created_by  TEXT REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Blocos de conteúdo (ordenados por position)
CREATE TABLE blocks (
  id          TEXT PRIMARY KEY,        -- UUID
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,           -- 'hero'|'grid'|'text'|'map'|'video'|'divider'
  position    INTEGER NOT NULL,        -- ordem na timeline
  content     TEXT NOT NULL,           -- JSON com dados do bloco (ver abaixo)
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comentários
CREATE TABLE comments (
  id          TEXT PRIMARY KEY,        -- UUID
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL,           -- asset_id do Immich
  author_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  approved    INTEGER DEFAULT 1,       -- sempre aprovado; admin pode apagar
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fotos conhecidas de cada story (cache de sync)
CREATE TABLE story_assets (
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL,
  album_id    TEXT NOT NULL,
  seen_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (story_id, asset_id)
);

-- Notificações de sync pendentes
CREATE TABLE sync_notifications (
  id          TEXT PRIMARY KEY,
  story_id    TEXT REFERENCES stories(id) ON DELETE CASCADE,
  new_asset_ids TEXT NOT NULL,         -- JSON array
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  dismissed   INTEGER DEFAULT 0
);
```

---

## Tipos de Blocos (schema JSON do campo `content`)

### `hero`
```json
{
  "asset_id": "abc123",
  "caption": "Texto opcional",
  "overlay": true,
  "height": "full"
}
```

### `grid`
```json
{
  "asset_ids": ["a", "b", "c", "d"],
  "columns": 3,
  "gap": "sm",
  "aspect": "square"
}
```

### `text`
```json
{
  "markdown": "## Título\n\nTexto em **bold**...",
  "align": "left",
  "max_width": "prose"
}
```

### `map`
```json
{
  "mode": "manual",
  "lat": 38.4,
  "lng": -8.7,
  "zoom": 12,
  "label": "Comporta",
  "markers": [],
  "route": null
}
```
Para modo `auto`:
```json
{
  "mode": "auto",
  "asset_ids": ["a", "b", "c"],
  "show_route": true,
  "route_color": "#E07B54"
}
```

### `video`
```json
{
  "asset_id": "vid1",
  "caption": "",
  "autoplay": false,
  "loop": false
}
```

### `divider`
```json
{
  "style": "line",
  "label": "2024 · Verão"
}
```

---

## API do Backend

### Autenticação

```
POST /api/auth/login
  body: { email, password }   → { token, user }

POST /api/auth/immich
  body: { immich_url, api_key }  → { token, user }
  # Valida a API key contra o Immich e cria/actualiza o user local

GET  /api/auth/me             → { user }
```

**Nota sobre autenticação Immich:** O backend valida a API key do utilizador contra `GET /api/users/me` do Immich. Se válida, cria ou actualiza o registo local. Os utilizadores podem autenticar-se das duas formas (credenciais locais ou API key Immich).

### Stories

```
GET    /api/stories                   → lista (apenas do user autenticado ou admin)
POST   /api/stories                   → criar story
GET    /api/stories/:id               → detalhes (admin/editor)
PUT    /api/stories/:id               → actualizar metadados
DELETE /api/stories/:id               → apagar
POST   /api/stories/:id/publish       → publicar/despublicar
POST   /api/stories/:id/password      → definir/remover password

# Viewer público (não requer autenticação)
GET    /api/public/:slug              → story + blocos (verifica password via header)
POST   /api/public/:slug/unlock       body: { password } → { token_temporario }
```

### Blocos

```
GET    /api/stories/:id/blocks        → lista ordenada
POST   /api/stories/:id/blocks        → criar bloco
PUT    /api/stories/:id/blocks/:bid   → actualizar bloco
DELETE /api/stories/:id/blocks/:bid   → apagar bloco
POST   /api/stories/:id/blocks/reorder → { ordered_ids: [...] }
```

### Immich (proxy + sync)

```
GET    /api/immich/albums             → álbuns acessíveis com a API key do user
GET    /api/immich/albums/:id/assets  → assets de um álbum
GET    /api/immich/assets/:id/thumb   → proxy de thumbnail (evitar CORS no viewer)
GET    /api/immich/assets/:id/original → proxy de original

POST   /api/stories/:id/sync          → forçar sync manual
GET    /api/stories/:id/sync/status   → { new_assets: [...], last_sync: ... }
POST   /api/stories/:id/sync/dismiss  → marcar notificação como vista
```

### Comentários

```
GET    /api/public/:slug/comments/:asset_id   → lista de comentários
POST   /api/public/:slug/comments/:asset_id   → criar comentário (público)
  body: { author_name, body }

# Admin
GET    /api/stories/:id/comments              → todos os comentários da story
DELETE /api/comments/:cid                     → apagar (admin)
```

---

## Sincronização com Immich

### Fluxo de Sync

1. **Job periódico** (a cada N minutos, configurável via `.env`) compara os assets actuais do álbum com `story_assets`.
2. Se há assets novos:
   - `sync_mode = 'auto'`: cria automaticamente um bloco `grid` no fim da story com os novos assets. O editor pode mover/editar depois.
   - `sync_mode = 'notify'`: regista em `sync_notifications`. O editor vê um badge no dashboard e pode escolher o que fazer com cada foto.
   - `sync_mode = 'manual'`: não faz nada automaticamente.

### Viewer e URLs das Imagens

As imagens são servidas **directamente pelo Immich** quando possível. O backend expõe rotas de proxy (`/api/immich/assets/:id/thumb`) apenas para o caso de CORS ou álbuns que requeiram API key. O viewer usa a URL do Immich configurada no `.env` para construir as URLs de imagem directamente, o que evita duplicação de storage.

---

## Frontend — Páginas e Componentes

### `/login`
- Login com email/password local
- Login com URL do Immich + API key
- Redirecciona para `/dashboard`

### `/dashboard`
- Grelha de stories do utilizador
- Badge de sync pendente por story
- Botão "Nova Story"
- Admin vê todas as stories

### `/editor/:id`
- **Painel esquerdo**: lista de blocos drag-and-drop (biblioteca de blocos)
- **Área central**: preview da timeline em tempo real
- **Painel direito**: propriedades do bloco seleccionado
- **Toolbar superior**: publicar, settings, link público, sync status
- **Selector de álbuns Immich**: picker que lista álbuns disponíveis; permite seleccionar múltiplos
- **Import automático**: botão "Importar álbum" gera blocos iniciais ordenados por data (hero para a primeira foto, grids de 3 para as restantes, com divisores por mês)

### `/:slug` (Viewer público)
- **Mini menu lateral/topo**: âncoras para cada bloco com label (gerado a partir dos dividers e títulos de texto)
- **Pesquisa**: filtra por texto nas captions e texto dos blocos
- **Scroll suave** entre secções
- **Comentários**: por foto, com nome, sem login
- Protegido por password se definida (modal de unlock antes de ver conteúdo)
- Meta tags OpenGraph para partilha

---

## Autenticação e Autorização

| Rota | Acesso |
|---|---|
| `/:slug` | Público (+ password opcional) |
| `/api/public/*` | Público (+ password opcional) |
| `/login` | Público |
| `/dashboard`, `/editor/*` | Autenticado |
| `DELETE /api/comments/*` | Admin ou criador da story |
| `DELETE /api/stories/*` | Admin ou criador da story |

**Roles:**
- `admin`: acesso a tudo, pode apagar comentários de qualquer story
- `editor`: pode criar e gerir as suas próprias stories

---

## Mapas (OpenStreetMap + Leaflet)

- Biblioteca: **Leaflet.js** com tiles do OpenStreetMap (sem API key, gratuito)
- Modo manual: pin colocado pelo editor, label opcional
- Modo auto: extrai coordenadas GPS dos EXIF via endpoint Immich (`/api/assets/:id`) e plota markers; opção de ligar com polyline de rota
- Clusters automáticos quando há muitos pontos (plugin `leaflet.markercluster`)
- No editor: mapa interactivo para posicionar pin ou seleccionar assets para rota

---

## Partilha Pública

- URL: `https://[dominio]/[slug]` — slug definido pelo editor (validado: lowercase, hífens, sem espaços)
- Password: bcrypt hash guardado na story; token temporário de sessão para o viewer
- Link de partilha copiável no editor
- Meta tags OpenGraph: título, descrição, imagem de capa

---

## Docker Compose

```yaml
version: '3.9'

services:
  backend:
    build: ./backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_PATH=/data/db.sqlite
      - JWT_SECRET=${JWT_SECRET}
      - IMMICH_URL=${IMMICH_URL}         # ex: https://immich.exemplo.com
      - SYNC_INTERVAL_MINUTES=15
    volumes:
      - story_data:/data
    ports:
      - "3001:3001"

  frontend:
    build: ./frontend
    restart: unless-stopped
    environment:
      - VITE_API_URL=/api
      - VITE_IMMICH_URL=${IMMICH_URL}
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  story_data:
```

**Nota CasaOS**: os dois serviços podem ser expostos via Cloudflare Tunnel. O frontend (`3000`) é o ponto de entrada público. O backend (`3001`) pode ficar interno ou também exposto se necessário.

---

## Variáveis de Ambiente (`.env.example`)

```env
# Backend
JWT_SECRET=alterar_para_secret_longo
DATABASE_PATH=/data/db.sqlite
IMMICH_URL=https://immich.exemplo.com
SYNC_INTERVAL_MINUTES=15
ADMIN_EMAIL=admin@exemplo.com        # primeiro user a registar fica como admin

# Frontend (build time)
VITE_API_URL=http://localhost:3001
VITE_IMMICH_URL=https://immich.exemplo.com
```

---

## Fases de Desenvolvimento Sugeridas

### Fase 1 — Core
- [ ] Setup do projecto (Vite + Express + SQLite + Docker)
- [ ] Autenticação (local + Immich API key)
- [ ] CRUD de stories e blocos
- [ ] Viewer público básico (sem password)
- [ ] Blocos: `hero`, `grid`, `text`

### Fase 2 — Editor Visual
- [ ] Drag-and-drop de blocos (dnd-kit)
- [ ] Painel de propriedades por tipo de bloco
- [ ] Markdown editor para blocos de texto
- [ ] Import automático de álbum
- [ ] Proxy de imagens Immich

### Fase 3 — Features Avançadas
- [ ] Blocos `map` e `video`
- [ ] Sincronização automática/notificações
- [ ] Comentários públicos + gestão admin
- [ ] Password por story
- [ ] Mini menu + pesquisa no viewer

### Fase 4 — Polimento
- [ ] Meta tags OpenGraph
- [ ] Slugs personalizados
- [ ] UI responsiva mobile

---

## Dependências Principais

### Backend
```json
{
  "express": "^4.x",
  "better-sqlite3": "^9.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "node-cron": "^3.x",
  "axios": "^1.x",
  "uuid": "^9.x"
}
```

### Frontend
```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^7.x",
  "leaflet": "^1.x",
  "react-leaflet": "^4.x",
  "react-markdown": "^9.x",
  "@uiw/react-md-editor": "^4.x",
  "axios": "^1.x"
}
```
