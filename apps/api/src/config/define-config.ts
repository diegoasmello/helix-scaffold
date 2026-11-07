import { z } from 'zod'

// ─────────────────────────────────────────────
// Public types — what you write in `src/app.config.ts`.
// Every field is optional; omitted fields fall back to the defaults below.
// ─────────────────────────────────────────────

type ConfigMode = 'development' | 'production' | 'test'

interface ConfigContext {
  /** Current `NODE_ENV`. Use it for values that differ between environments. */
  mode: ConfigMode
}

interface SocialProviderConfig {
  /**
   * Enables this provider for sign-in and account linking.
   * Requires the provider's `CLIENT_ID` and `CLIENT_SECRET` in `.env` —
   * the API refuses to start if they are missing.
   * @default false
   */
  enabled?: boolean
}

interface AppleProviderConfig extends SocialProviderConfig {
  /** Bundle ID of your native iOS app. Only needed for native sign-in. */
  appBundleId?: string
}

interface PlanConfig {
  /**
   * Stable identifier stored on each subscription (`planId`) and sent by your
   * payment processor's webhooks. Do not rename it once subscriptions use it.
   */
  id: string
  /** Display name shown in the admin panel and on the user's subscription page. */
  name: string
  /**
   * Features this plan unlocks. A feature is any key you choose — usually a
   * module name (`'todos'`) or a capability (`'pdf-export'`). Gate routes with
   * `requireSubscription('<feature>')` and UI with
   * `<RequiresSubscription feature="<feature>">`.
   */
  features: string[]
}

interface TrialConfig {
  /** Trial length in days. */
  days: number
  /** Plan assigned to the trial subscription. Must be one of `subscriptions.plans`. */
  planId: string
}

export interface AppConfig {
  app?: {
    /**
     * Product name. Shown as the title of the API docs (`/api/docs`).
     * @default 'Helix API'
     */
    name?: string
  }

  server?: {
    /** @default 3333 */
    port?: number
    /** @default '0.0.0.0' */
    host?: string
    /**
     * Which proxies in front of the API to trust for the client's IP
     * (Fastify's `trustProxy`). It decides `request.ip`, which better-auth
     * rate-limits sign-ins by and records on sessions, and the audit log's
     * `ip`.
     *
     * - `false` — nothing in front: the IP is the connection's, and an
     *   `X-Forwarded-For` header (anyone can send one) is ignored.
     * - `true` — trust every hop (only when the proxy strips the header the
     *   client sent).
     * - a number — trust that many hops (`1`: one reverse proxy).
     * - IPs / CIDRs (`'10.0.0.0/8'` or an array) — trust only those proxies.
     *
     * Behind a proxy, leaving `false` puts every client under the proxy's IP,
     * so all sign-ins share one rate limit — and so do all the anonymous
     * requests to the public API and to `/api/files/*` (`publicApi.rateLimit`,
     * `uploads.rateLimit`). The API logs a warning when a request's
     * `X-Forwarded-For` was ignored.
     * @default false
     */
    trustProxy?: boolean | number | string | string[]
  }

  registration?: {
    /**
     * Who can create accounts.
     * - `'closed'` — only admins create accounts (`POST /users`).
     * - `'open'` — anyone can self-register via `/sign-up` or social login.
     *   Bootstrap also creates a default "User" role for self-registered users.
     * @default 'closed'
     */
    mode?: 'open' | 'closed'
  }

  auth?: {
    /**
     * Social login providers. Credentials live in `.env` (see `.env.example`).
     * Only offered in `'open'` registration mode: closed mode is email/password
     * only — no social buttons on the login page and no account linking on
     * `/me/security` (`GET /registration/status` and `GET /me/providers`
     * list no provider there).
     */
    socialProviders?: {
      google?: SocialProviderConfig
      facebook?: SocialProviderConfig
      apple?: AppleProviderConfig
    }
  }

  subscriptions?: {
    /**
     * Activates the subscription infrastructure: admin routes, the
     * `requireSubscription()` gate and trial auto-start.
     * When `false`, `requireSubscription()` is a no-op — zero overhead.
     * @default false
     */
    enabled?: boolean
    /**
     * Plan catalog. Every subscription's `planId` must be one of these ids.
     * Required (at least one plan) when `enabled: true`.
     * Pricing and billing intervals belong to your payment processor, not here.
     * @default []
     */
    plans?: PlanConfig[]
    /**
     * Auto-creates a trialing subscription when a user self-registers.
     * Only takes effect when `enabled: true` and `registration.mode: 'open'`.
     * Set to `false` to disable trials.
     * @default false
     */
    trial?: TrialConfig | false
    /**
     * Days a `past_due` subscription (failed payment) keeps access, counted
     * from when it entered `past_due` (`pastDueSince`). Set it to roughly the
     * payment processor's retry window. `0` blocks access immediately.
     * @default 0
     */
    pastDueGraceDays?: number
    /**
     * Periodic job that marks lapsed subscriptions as `expired`: trials past
     * `trialEndsAt` and active subscriptions past `currentPeriodEnd`.
     * Only touches subscriptions **without `externalId`** — the ones the
     * scaffold created (trial auto-start, admin panel). Subscriptions with an
     * `externalId` belong to the payment processor and are updated by its
     * webhooks. Access may outlive the period by up to one interval.
     */
    expiration?: {
      /**
       * How often the job runs. It also runs once at startup.
       * @default 1
       */
      intervalHours?: number
    }
  }

  publicApi?: {
    /**
     * Registers the public API: the routes under `/api/public/*` a site reads
     * without signing in (a module's `<feature>-public-routes.ts`), and lets
     * `GET /api/files/*` serve the files of published records to anyone.
     * When `false`, none of it exists — zero overhead.
     * @default false
     */
    enabled?: boolean
    /**
     * Origins allowed to call `/api/public/*` from a browser (CORS, without
     * credentials): `['https://www.example.com']`. Leave empty when the site
     * reads the API on its server (SSR, static generation) — it needs no CORS.
     * `<img>` tags pointing to `/api/files/*` never need it.
     * @default []
     */
    origins?: string[]
    /**
     * How long (seconds) browsers and CDNs may keep a public answer — the JSON
     * of `/api/public/*` and a published record's files (`Cache-Control:
     * public, max-age`). A record unpublished or edited may still show for
     * that long. `0` sends `no-cache`: every request asks the API again.
     * @default 60
     */
    cacheSeconds?: number
    /**
     * Requests one client IP (`request.ip`) may make to `/api/public/*` per
     * window; above it the API answers 429 `rate_limited`. Counted in memory,
     * per process. Behind a reverse proxy, set `server.trustProxy`, or every
     * visitor shares the proxy's IP — and this one count.
     */
    rateLimit?: {
      /** @default 300 */
      max?: number
      /** @default 60 */
      windowSeconds?: number
    }
  }

  email?: {
    /**
     * Whether the API sends email (through Resend, `RESEND_API_KEY` in `.env`).
     * - `true` — password reset by email (`/forgot-password`), self-service
     *   email change confirmed by a link, and security notices (password
     *   changed, email change requested). In production the API refuses to
     *   start without `RESEND_API_KEY`; in development the emails are printed
     *   to the console instead.
     * - `false` — nothing is sent and nothing needs Resend. There is no
     *   password reset and no self-service email change: the web asks users to
     *   contact an administrator, who sets their password and email on
     *   `/users`. The admin changes their own email on `/me/account` with
     *   their current password, and recovers a forgotten password on the
     *   server (`pnpm admin:reset-password`).
     *
     * Open registration needs `true`: self-registered users have no
     * administrator to recover their account.
     * @default false
     */
    enabled?: boolean
    /**
     * Sender address for all outgoing emails. Must belong to a domain
     * verified in Resend.
     * @default 'noreply@localhost'
     */
    from?: string
  }

  uploads?: {
    /**
     * Storage backend. Only `'local'` is implemented; `'s3'` is a stub that throws.
     * @default 'local'
     */
    storage?: 'local' | 's3'
    /**
     * Directory where uploaded files are stored (`'local'` storage only).
     * @default './storage'
     */
    dir?: string
    /**
     * Maximum upload size in megabytes.
     * @default 50
     */
    maxSizeMb?: number
    /**
     * Requests one client IP (`request.ip`, see `server.trustProxy`) may make
     * to `GET /api/files/*` per window without a session — the route also
     * serves published files to anyone. A signed-in user is never counted (a
     * forged cookie is no session). Above it the API answers 429
     * `rate_limited`. A site with heavy traffic puts a CDN in front of its
     * files. Counted in memory, per process — and per proxy IP behind a proxy
     * `server.trustProxy` does not trust.
     */
    rateLimit?: {
      /** @default 1000 */
      max?: number
      /** @default 60 */
      windowSeconds?: number
    }
    /** Periodic removal of uploads that no record references anymore. */
    orphanCleanup?: {
      /**
       * How often the cleanup job runs.
       * @default 6
       */
      intervalHours?: number
      /**
       * Minimum age of an unreferenced upload before it is deleted — gives
       * clients time to attach a freshly uploaded file to a record.
       * @default 24
       */
      graceHours?: number
    }
  }

  logger?: {
    /** @default 'info' */
    level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
    /**
     * Human-readable log output via pino-pretty. Keep it off in production.
     * @default false
     */
    pretty?: boolean
  }
}

export type AppConfigFactory = (context: ConfigContext) => AppConfig

/**
 * Declares the application config with full type-checking and inline docs.
 * Accepts a plain object or a function receiving `{ mode }`.
 */
export function defineConfig(config: AppConfig | AppConfigFactory) {
  return config
}

// ─────────────────────────────────────────────
// Runtime schema — validates values and applies defaults.
// Strict objects reject unknown keys, so a typo fails at startup
// instead of being silently ignored.
// ─────────────────────────────────────────────

const socialProviderSchema = z.strictObject({
  enabled: z.boolean().default(false),
})

export const appConfigSchema = z.strictObject({
  app: z
    .strictObject({
      name: z.string().min(1).default('Helix API'),
    })
    .prefault({}),
  server: z
    .strictObject({
      port: z.number().int().positive().default(3333),
      host: z.string().min(1).default('0.0.0.0'),
      trustProxy: z
        .union([
          z.boolean(),
          z.number().int().min(1),
          z.string().min(1),
          z.array(z.string().min(1)).min(1),
        ])
        .default(false),
    })
    .prefault({}),
  registration: z
    .strictObject({
      mode: z.enum(['open', 'closed']).default('closed'),
    })
    .prefault({}),
  auth: z
    .strictObject({
      socialProviders: z
        .strictObject({
          google: socialProviderSchema.prefault({}),
          facebook: socialProviderSchema.prefault({}),
          apple: socialProviderSchema
            .extend({ appBundleId: z.string().min(1).optional() })
            .prefault({}),
        })
        .prefault({}),
    })
    .prefault({}),
  subscriptions: z
    .strictObject({
      enabled: z.boolean().default(false),
      plans: z
        .array(
          z.strictObject({
            id: z.string().min(1).max(100),
            name: z.string().min(1),
            features: z.array(z.string().min(1)),
          })
        )
        .default([]),
      trial: z
        .union([
          z.literal(false),
          z.strictObject({
            days: z.number().int().positive(),
            planId: z.string().min(1),
          }),
        ])
        .default(false),
      pastDueGraceDays: z.number().int().nonnegative().default(0),
      expiration: z
        .strictObject({
          intervalHours: z.number().positive().default(1),
        })
        .prefault({}),
    })
    .prefault({}),
  publicApi: z
    .strictObject({
      enabled: z.boolean().default(false),
      origins: z.array(z.url()).default([]),
      cacheSeconds: z.number().int().nonnegative().default(60),
      rateLimit: z
        .strictObject({
          max: z.number().int().positive().default(300),
          windowSeconds: z.number().int().positive().default(60),
        })
        .prefault({}),
    })
    .prefault({}),
  email: z
    .strictObject({
      enabled: z.boolean().default(false),
      from: z.string().min(1).default('noreply@localhost'),
    })
    .prefault({}),
  uploads: z
    .strictObject({
      storage: z.enum(['local', 's3']).default('local'),
      dir: z.string().min(1).default('./storage'),
      maxSizeMb: z.number().positive().default(50),
      rateLimit: z
        .strictObject({
          max: z.number().int().positive().default(1000),
          windowSeconds: z.number().int().positive().default(60),
        })
        .prefault({}),
      orphanCleanup: z
        .strictObject({
          intervalHours: z.number().positive().default(6),
          graceHours: z.number().nonnegative().default(24),
        })
        .prefault({}),
    })
    .prefault({}),
  logger: z
    .strictObject({
      level: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
      pretty: z.boolean().default(false),
    })
    .prefault({}),
})

export type ResolvedAppConfig = z.output<typeof appConfigSchema>
