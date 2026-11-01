import z from 'zod'

import type { Config } from '@/config'
import type { FastifyTypedInstance } from '@/types'

import { subscriptionPlanSchema } from './subscriptions-schema'

export async function subscriptionStatusRoutes(
  app: FastifyTypedInstance,
  { config }: { config: Config }
) {
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
