import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { config } from '@/config'
import type { Database } from '@/db'
import { env } from '@/env'
import type { EmailProvider } from '@/lib/email'
import {
  applySelfRegistrationDefaults,
  type ErrorLogger,
} from '@/modules/registration/self-registration'

// Scripts (the seed) have no Fastify logger; buildApp passes `app.log`.
const consoleLogger: ErrorLogger = {
  error: (obj, msg) => console.error(msg, obj),
}

export function createAuth(
  database: Database,
  emailProvider: EmailProvider,
  logger: ErrorLogger = consoleLogger
) {
  const { google, facebook, apple } = config.auth.socialProviders
  const disableSignUp = config.registration.mode !== 'open'

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            // Self-registration only. `auth.api.signUpEmail()` called by the
            // server (POST /users, bootstrap, seed) carries no request: those
            // callers set the role themselves and must not start a trial.
            if (config.registration.mode !== 'open' || !ctx?.request) return
            await applySelfRegistrationDefaults(
              database,
              user.id,
              config.subscriptions,
              logger
            )
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        await emailProvider.send(
          user.email,
          'Reset your password',
          `<p>You requested a password reset.</p>
           <p>Click the link below to reset your password:</p>
           <p><a href="${url.replace(/"/g, '&quot;')}">Reset password</a></p>
           <p>This link expires in 1 hour. If you did not request this change, you can safely ignore this email.</p>`
        )
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
           <p><a href="${url}">Confirm new email address</a></p>
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
