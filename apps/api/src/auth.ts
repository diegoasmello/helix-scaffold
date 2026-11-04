import { APIError, betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'

import type { Config } from '@/config'
import type { Database } from '@/db'
import { env } from '@/env'
import { type EmailProvider, escapeHtml } from '@/lib/email'
import {
  applySelfRegistrationDefaults,
  type ProvisioningLogger,
} from '@/modules/accounts/account-provisioning'

// Scripts (the seed) have no Fastify logger; buildApp passes `app.log`.
const consoleLogger: ProvisioningLogger = {
  error: (obj, msg) => console.error(msg, obj),
  warn: (obj, msg) => console.warn(msg, obj),
}

export function createAuth(
  database: Database,
  emailProvider: EmailProvider,
  config: Config,
  logger: ProvisioningLogger = consoleLogger
) {
  const { google, facebook, apple } = config.auth.socialProviders
  const disableSignUp = config.registration.mode !== 'open'

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),
    hooks: {
      // Closed registration: refuse email sign-up over HTTP. Matched on the
      // endpoint better-auth routed the request to (`ctx.path` is the
      // endpoint's own path), never on the URL, so no spelling of it (`/./`,
      // `%2e`, `..`, absolute-form) gets past. `auth.api.signUpEmail()` called
      // by the server (account provisioning) carries no request and still runs.
      before: createAuthMiddleware(async (ctx) => {
        if (disableSignUp && ctx.path === '/sign-up/email' && ctx.request) {
          throw new APIError('FORBIDDEN', { message: 'Registration is closed' })
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            // Self-registration only. `auth.api.signUpEmail()` called by the
            // server (account provisioning: POST /users, bootstrap, seed)
            // carries no request: those callers set the role themselves and
            // must not start a trial.
            if (!ctx?.request) return
            await applySelfRegistrationDefaults(
              database,
              user.id,
              config,
              logger
            )
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      // A reset signs out every session of the account, a stolen one included
      // — like PATCH /me/password does.
      revokeSessionsOnPasswordReset: true,
      // Not awaited: better-auth only calls this for a registered email, and
      // waits for it before answering — so an awaited send (a round trip to
      // Resend) would make `POST /auth/request-password-reset` slower for
      // registered addresses than for unknown ones, telling anyone which
      // emails have an account. better-auth already answered 200 when the send
      // failed, so the client sees no difference; the failure is logged here.
      sendResetPassword: async ({ user, url }) => {
        emailProvider
          .send(
            user.email,
            'Reset your password',
            `<p>You requested a password reset.</p>
           <p>Click the link below to reset your password:</p>
           <p><a href="${escapeHtml(url)}">Reset password</a></p>
           <p>This link expires in 1 hour. If you did not request this change, you can safely ignore this email.</p>`
          )
          .catch((error: unknown) => {
            logger.error(
              { err: error, userId: user.id },
              'Failed to send password reset email'
            )
          })
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      sendVerificationEmail: async ({ user, url }) => {
        await emailProvider.send(
          user.email,
          'Confirm your new email address',
          `<p>You requested an email address change.</p>
           <p>Click the link below to confirm your new email address:</p>
           <p><a href="${escapeHtml(url)}">Confirm new email address</a></p>
           <p>This link expires in 1 hour. If you did not request this change, you can safely ignore this email.</p>`
        )
      },
    },
    user: {
      changeEmail: {
        enabled: true,
      },
      additionalFields: {
        roleId: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    socialProviders: {
      // Credentials are guaranteed by config validation when a provider is enabled.
      ...(google.enabled && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              disableSignUp,
            },
          }
        : {}),
      ...(facebook.enabled &&
      env.FACEBOOK_CLIENT_ID &&
      env.FACEBOOK_CLIENT_SECRET
        ? {
            facebook: {
              clientId: env.FACEBOOK_CLIENT_ID,
              clientSecret: env.FACEBOOK_CLIENT_SECRET,
              disableSignUp,
            },
          }
        : {}),
      ...(apple.enabled && env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              clientSecret: env.APPLE_CLIENT_SECRET,
              ...(apple.appBundleId
                ? { appBundleIdentifier: apple.appBundleId }
                : {}),
              disableSignUp,
            },
          }
        : {}),
    },
    secret: env.AUTH_SECRET,
    baseURL: env.BASE_URL,
    trustedOrigins: [env.CLIENT_URL],
  })
}

export type Auth = ReturnType<typeof createAuth>
