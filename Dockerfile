# syntax=docker/dockerfile:1

# Production images, built by docker-compose.prod.yml (README → Deploying with
# Docker):
#   api — the API, which applies pending migrations before it starts;
#   web — Caddy: the SPA, HTTPS and the proxy that sends /api/* to the API.
# Build on the server's architecture: sharp is a native module.

ARG NODE_IMAGE=node:22-bookworm-slim

# ── Dependencies ─────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS fetch
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true HUSKY=0
RUN corepack enable
WORKDIR /repo
# Every package of the lockfile into pnpm's store, from the lockfile alone: the
# layer stays cached until it changes, and the installs below run offline.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# The whole workspace, to build. The install also generates @helix/api-client
# from openapi.json (postinstall).
FROM fetch AS deps
COPY . .
RUN pnpm install --offline --frozen-lockfile

# The API's production dependencies only: its bundle holds only src/, so they
# are installed next to it (in node_modules/, linked from apps/api/node_modules/).
# No scripts: the root's `prepare` runs husky, a dev dependency, and sharp ships
# its native binary as a package of its own (@img/sharp-<platform>). Without
# the node_modules `pnpm fetch` left, which holds every package of the lockfile.
FROM fetch AS api-deps
COPY apps/api/package.json apps/api/
RUN rm -rf node_modules \
  && pnpm install --offline --frozen-lockfile --prod --filter api --ignore-scripts

# ── API build ────────────────────────────────────────────────────────────────
FROM deps AS api-build
RUN pnpm --filter api build

# ── Web build ────────────────────────────────────────────────────────────────
# VITE_API_URL is written into the bundle: changing it means a new build.
FROM deps AS web-build
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" \
  || { echo 'The build arg VITE_API_URL is required (https://<domain>).' >&2; exit 1; }
RUN pnpm --filter web build

# ── api ──────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production
# The workspace's layout, which pnpm's links rely on
WORKDIR /app/apps/api
COPY --from=api-deps /repo/node_modules /app/node_modules
COPY --from=api-deps /repo/apps/api/node_modules ./node_modules
COPY apps/api/package.json ./
COPY --from=api-build /repo/apps/api/dist ./dist
# Uploads (`uploads.dir: './storage'` in app.config.ts): a volume in
# docker-compose.prod.yml, created owned by the user the API runs as.
RUN mkdir storage && chown node:node storage
USER node
EXPOSE 3333
CMD ["sh", "-c", "node --enable-source-maps dist/migrate.js && exec node --enable-source-maps dist/server.js"]

# ── web ──────────────────────────────────────────────────────────────────────
FROM caddy:2.11-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /repo/apps/web/dist /srv
