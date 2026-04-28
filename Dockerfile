# ── Stage 1: Build frontend (Vite) ──────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Compile backend native deps (better-sqlite3) ────────
FROM node:20-alpine AS backend-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production

# ── Stage 3: Production image ────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy pre-compiled node_modules (native .node files built on Alpine)
COPY --from=backend-deps /app/node_modules ./node_modules

# App source
COPY backend/src ./src

# Frontend static files (served by Express in NODE_ENV=production)
# Express resolve: path.join(__dirname, '../../frontend/dist') = /frontend/dist
COPY --from=frontend-build /frontend/dist /frontend/dist

# Data directory — mount a persistent volume here (GCS bucket / NFS)
RUN mkdir -p /data

COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["/app/entrypoint.sh"]
