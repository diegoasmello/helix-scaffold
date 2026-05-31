import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { roles, user as userTable } from '@/db/schema'
import { env } from '@/env'
import type { EmailProvider } from '@/lib/email'

export function createAuth(database: Database, emailProvider: EmailProvider) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (env.REGISTRATION_MODE !== 'open') return
            const [defaultRole] = await database
              .select()
              .from(roles)
              .where(eq(roles.isDefault, true))
              .limit(1)
            if (defaultRole) {
              await database
                .update(userTable)
                .set({ roleId: defaultRole.id })
                .where(eq(userTable.id, user.id))
            }
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
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              disableSignUp: env.REGISTRATION_MODE !== 'open',
            },
          }
        : {}),
      ...(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
        ? {
            facebook: {
              clientId: env.FACEBOOK_CLIENT_ID,
              clientSecret: env.FACEBOOK_CLIENT_SECRET,
              disableSignUp: env.REGISTRATION_MODE !== 'open',
            },
          }
        : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              clientSecret: env.APPLE_CLIENT_SECRET,
              ...(env.APPLE_APP_BUNDLE_ID
                ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_ID }
                : {}),
              disableSignUp: env.REGISTRATION_MODE !== 'open',
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
