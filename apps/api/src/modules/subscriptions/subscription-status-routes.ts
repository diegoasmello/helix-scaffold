import z from 'zod'

import { config } from '@/config'
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
    async () => ({ enabled: config.subscriptions.enabled })
  )
}
