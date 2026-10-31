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
    // Auto-starts a trial on self-registration, e.g. { days: 14, planId: 'trial' }
    trial: false,
  },

  email: {
    from: 'noreply@localhost',
  },

  uploads: {
    storage: 'local',
    dir: './storage',
    maxSizeMb: 50,
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
