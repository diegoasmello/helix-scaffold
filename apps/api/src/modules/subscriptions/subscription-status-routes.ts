import z from 'zod'

import { config } from '@/config'
import type { FastifyTypedInstance } from '@/types'

import { subscriptionPlanSchema } from './subscriptions-schema'

export async function subscriptionStatusRoutes(app: FastifyTypedInstance) {
  app.get(
    '/subscription/status',
    {
      schema: {
        tags: ['subscriptions'],
        description:
          'Get subscription feature status and the plan catalog (empty when disabled)',
        response: {
          200: z.object({
            enabled: z.boolean(),
            plans: z.array(subscriptionPlanSchema),
          }),
        },
      },
    },
    async () => {
      const { enabled, plans } = config.subscriptions
      return {
        enabled,
        plans: enabled
          ? plans.map((plan) => ({ ...plan, features: [...plan.features] }))
          : [],
      }
    }
  )
}
