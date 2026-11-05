import { defineConfig } from '@/config/define-config'

// ─────────────────────────────────────────────
// Application config — the product decisions for this app.
//
// Hover any field for its docs and default. Omitted fields use the default.
// Secrets and per-deploy values (database URL, auth secret, public URLs,
// API keys, OAuth credentials) live in `.env` — never here.
//
// Related registries in `src/config/`:
//   - permissions.ts        → RBAC resources and their actions
//   - upload-references.ts  → tables that reference uploads (orphan cleanup)
// ─────────────────────────────────────────────

export default defineConfig(({ mode }) => ({
  app: {
    name: 'Helix API',
  },

  server: {
    port: 3333,
    host: '0.0.0.0',
    // Behind a reverse proxy (nginx, a load balancer, Cloudflare), set how
    // many hops to trust (`1`) or the proxy's IPs — see `trustProxy`'s docs.
    // Every rate limit counts per client IP: left `false` there, all clients
    // share the proxy's.
    trustProxy: false,
  },

  registration: {
    // 'closed' → only admins create accounts | 'open' → anyone can sign up
    mode: 'closed',
  },

  auth: {
    // Credentials for each provider live in `.env`.
    socialProviders: {
      google: { enabled: false },
      facebook: { enabled: false },
      apple: { enabled: false },
    },
  },

  subscriptions: {
    enabled: false,
    // Plan catalog. `features` are the keys checked by requireSubscription('<feature>').
    plans: [
      { id: 'starter', name: 'Starter', features: [] },
      { id: 'pro', name: 'Pro', features: ['todos'] },
    ],
    // Auto-starts a trial on self-registration, e.g. { days: 14, planId: 'pro' }
    trial: false,
    // Days a past_due subscription (failed payment) keeps access. 0 = cut immediately.
    pastDueGraceDays: 0,
    // Expires lapsed trials and admin-created subscriptions (not processor-managed ones).
    expiration: {
      intervalHours: 1,
    },
  },

  publicApi: {
    // Routes under /api/public/* a site reads without signing in, and the
    // files of published records open to anyone.
    enabled: false,
    // Browser origins allowed to call /api/public/* (CORS). Empty when the
    // site fetches on its server.
    origins: [],
    // Cache-Control max-age of public answers, in seconds.
    cacheSeconds: 60,
    // Requests per IP per window on /api/public/*.
    rateLimit: { max: 300, windowSeconds: 60 },
  },

  email: {
    from: 'noreply@localhost',
  },

  uploads: {
    storage: 'local',
    dir: './storage',
    maxSizeMb: 50,
    // Anonymous requests per IP per window on /api/files/* (signed-in users
    // are not counted).
    rateLimit: { max: 1000, windowSeconds: 60 },
    orphanCleanup: {
      intervalHours: 6,
      graceHours: 24,
    },
  },

  logger: {
    level: 'info',
    pretty: mode !== 'production',
  },
}))
