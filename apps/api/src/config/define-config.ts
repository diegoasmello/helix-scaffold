import { z } from 'zod'

// ─────────────────────────────────────────────
// Public types — what you write in `src/app.config.ts`.
// Every field is optional; omitted fields fall back to the defaults below.
// ─────────────────────────────────────────────

export type ConfigMode = 'development' | 'production' | 'test'

export interface ConfigContext {
  /** Current `NODE_ENV`. Use it for values that differ between environments. */
  mode: ConfigMode
}

export interface SocialProviderConfig {
  /**
   * Enables this provider for sign-in and account linking.
   * Requires the provider's `CLIENT_ID` and `CLIENT_SECRET` in `.env` —
   * the API refuses to start if they are missing.
   * @default false
   */
  enabled?: boolean
}

export interface AppleProviderConfig extends SocialProviderConfig {
  /** Bundle ID of your native iOS app. Only needed for native sign-in. */
  appBundleId?: string
}

export interface TrialConfig {
  /** Trial length in days. */
  days: number
  /** `planId` stored on the trial subscription. Must match your plan catalog. */
  planId: string
}

export interface AppConfig {
  app?: {
    /**
     * Product name. Shown as the title of the API docs (`/docs`).
     * @default 'Helix API'
     */
    name?: string
  }

  server?: {
    /** @default 3333 */
    port?: number
    /** @default '0.0.0.0' */
    host?: string
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
     * In `'closed'` registration mode, enabled providers are still available
     * for linking to existing accounts, but cannot create new accounts.
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
     * Auto-creates a trialing subscription when a user self-registers.
     * Only takes effect when `enabled: true` and `registration.mode: 'open'`.
     * Set to `false` to disable trials.
     * @default false
     */
    trial?: TrialConfig | false
  }

  email?: {
    /**
     * Sender address for all outgoing emails. Must belong to a domain
     * verified in Resend when `RESEND_API_KEY` is set.
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
      trial: z
        .union([
          z.literal(false),
          z.strictObject({
            days: z.number().int().positive(),
            planId: z.string().min(1),
          }),
        ])
        .default(false),
    })
    .prefault({}),
  email: z
    .strictObject({
      from: z.string().min(1).default('noreply@localhost'),
    })
    .prefault({}),
  uploads: z
    .strictObject({
      storage: z.enum(['local', 's3']).default('local'),
      dir: z.string().min(1).default('./storage'),
      maxSizeMb: z.number().positive().default(50),
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
