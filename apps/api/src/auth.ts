import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import type { Database } from '@/db'
import { env } from '@/env'

export function createAuth(database: Database) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
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
