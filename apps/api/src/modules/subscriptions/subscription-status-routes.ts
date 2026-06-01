import z from 'zod'

import { env } from '@/env'
import type { FastifyTypedInstance } from '@/types'

export async function subscriptionStatusRoutes(app: FastifyTypedInstance) {
  app.get(
    '/subscription/status',
    {
      schema: {
        tags: ['subscriptions'],
        description: 'Get subscription feature status',
        response: {
          200: z.object({ enabled: z.boolean() }),
        },
      },
    },
    async () => ({ enabled: env.SUBSCRIPTION_MODE === 'enabled' })
  )
}
