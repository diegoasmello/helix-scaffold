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

/** What better-auth hands its email callbacks. */
interface EmailLinkData {
  user: { id: string; email: string }
  url: string
}

export function createAuth(
  database: Database,
  emailProvider: EmailProvider,
  config: Config,
  logger: ProvisioningLogger = consoleLogger
) {
  const { google, facebook, apple } = config.auth.socialProviders
  const disableSignUp = config.registration.mode !== 'open'
  // Without email (`email.enabled: false`) better-auth gets no sender: its own
  // endpoints then refuse a password reset (400 `RESET_PASSWORD_DISABLED`) and
  // a verification email, and `changeEmail` is off (400). The admin's direct
  // email change goes through `me-service`, not better-auth.
  const emailEnabled = config.email.enabled

  // Not awaited: better-auth only calls this for a registered email, and
  // waits for it before answering — so an awaited send (a round trip to
  // Resend) would make `POST /auth/request-password-reset` slower for
  // registered addresses than for unknown ones, telling anyone which
  // emails have an account. better-auth already answered 200 when the send
  // failed, so the client sees no difference; the failure is logged here.
  const sendResetPassword = async ({ user, url }: EmailLinkData) => {
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
  }

  // Not awaited, for the reason `sendResetPassword` is not: better-auth
  // sends nothing when the new address already has an account, so an
  // awaited send would make `changeEmail` slower for a free address than
  // for a taken one. It already ignored a failed send; it is logged here.
  const sendVerificationEmail = async ({ user, url }: EmailLinkData) => {
    emailProvider
      .send(
        user.email,
        'Confirm your new email address',
        `<p>You requested an email address change.</p>
         <p>Click the link below to confirm your new email address:</p>
         <p><a href="${escapeHtml(url)}">Confirm new email address</a></p>
         <p>This link expires in 1 hour. If you did not request this change, you can safely ignore this email.</p>`
      )
      .catch((error: unknown) => {
        logger.error(
          { err: error, userId: user.id },
          'Failed to send email verification'
        )
      })
  }

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
      ...(emailEnabled ? { sendResetPassword } : {}),
    },
    emailVerification: {
      sendOnSignUp: false,
      ...(emailEnabled ? { sendVerificationEmail } : {}),
    },
    user: {
      changeEmail: {
        enabled: emailEnabled,
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
    advanced: {
      // Written by the `/auth/*` route in `src/app.ts` from Fastify's
      // `request.ip` (`server.trustProxy`) — never the client's own header.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    account: {
      accountLinking: {
        // Never join a social sign-in to an existing account by email alone:
        // email sign-ups are not verified, so whoever registered the address
        // first (an attacker) would keep a password into the account its real
        // owner then opens with Google. Linking stays explicit — signed in, on
        // /me/security (`linkSocial`).
        disableImplicitLinking: true,
      },
    },
    secret: env.AUTH_SECRET,
    baseURL: env.BASE_URL,
    trustedOrigins: [env.CLIENT_URL],
  })
}

export type Auth = ReturnType<typeof createAuth>
