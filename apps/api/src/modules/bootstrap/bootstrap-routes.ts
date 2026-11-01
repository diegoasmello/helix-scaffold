import { eq, sql } from 'drizzle-orm'
import z from 'zod'

import { ALL_PERMISSIONS } from '@/config/permissions'

import type { Auth } from '../../auth'
import { config } from '../../config'
import type { Database } from '../../db'
import { rolePermissions, roles, user } from '../../db/schema'
import type { FastifyTypedInstance } from '../../types'

const bootstrapStatusSchema = z.object({
  bootstrapped: z.boolean(),
})

const bootstrapBodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
})

async function isBootstrapped(database: Database): Promise<boolean> {
  const [{ count }] = await database
    .select({ count: sql<number>`count(*)` })
    .from(user)
  return Number(count) > 0
}

export async function bootstrapRoutes(
  app: FastifyTypedInstance,
  { database, auth }: { database: Database; auth: Auth }
) {
  app.get(
    '/bootstrap/status',
    {
      schema: {
        tags: ['bootstrap'],
        description: 'Check whether the system has been bootstrapped',
        response: { 200: bootstrapStatusSchema },
      },
    },
    async () => ({ bootstrapped: await isBootstrapped(database) })
  )

  app.post(
    '/bootstrap',
    {
      schema: {
        tags: ['bootstrap'],
        description: 'Create the first admin user with full permissions',
        body: bootstrapBodySchema,
        response: {
          201: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (await isBootstrapped(database)) {
        return reply
          .status(409)
          .send({ message: 'System already bootstrapped' })
      }

      // better-auth writes the user through its own connection, so it cannot
      // join the transaction below: create it first, then undo it if the rest
      // fails. Server-side calls skip the self-registration hook (no default
      // role, no trial) — see src/modules/registration/self-registration.ts.
      const { user: admin } = await auth.api.signUpEmail({
        body: {
          name: request.body.name,
          email: request.body.email,
          password: request.body.password,
        },
      })

      let raced = false
      try {
        await database.transaction(async (tx) => {
          // Serialises concurrent bootstraps: the second one waits here, then
          // sees two users and backs out.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext('helix:bootstrap'))`
          )
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(user)
          if (Number(count) > 1) {
            raced = true
            tx.rollback()
          }

          const [adminRole] = await tx
            .insert(roles)
            .values({ name: 'Admin', description: 'Full system access' })
            .returning()

          await tx.insert(rolePermissions).values(
            ALL_PERMISSIONS.map(({ resource, action }) => ({
              roleId: adminRole.id,
              resource,
              action,
            }))
          )

          await tx
            .update(user)
            .set({ roleId: adminRole.id })
            .where(eq(user.id, admin.id))

          if (config.registration.mode === 'open') {
            // No permissions: the profile only needs a session, and what
            // regular users may do is a product decision.
            await tx.insert(roles).values({
              name: 'User',
              description: 'Default role for self-registered users',
              isDefault: true,
            })
          }
        })
      } catch (error) {
        // Sessions and accounts cascade from the user row.
        await database.delete(user).where(eq(user.id, admin.id))
        if (raced) {
          return reply
            .status(409)
            .send({ message: 'System already bootstrapped' })
        }
        throw error
      }

      return reply
        .status(201)
        .send({ message: 'System bootstrapped successfully' })
    }
  )
}
