import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import type { Database } from '@/db'
import { env } from '@/env'
import type { EmailProvider } from '@/lib/email'

export function createAuth(database: Database, emailProvider: EmailProvider) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),
    emailAndPassword: {
      enabled: true,
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
    secret: env.AUTH_SECRET,
    baseURL: env.BASE_URL,
    trustedOrigins: [env.CLIENT_URL],
  })
}

export type Auth = ReturnType<typeof createAuth>
