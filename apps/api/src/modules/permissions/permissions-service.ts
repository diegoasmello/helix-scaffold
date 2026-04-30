import { and, eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { rolePermissions } from '@/db/schema'

import type { Grants } from './permissions-schema'

export function createPermissionsService(database: Database) {
  async function getByRoleId(roleId: string): Promise<Grants> {
    const rows = await database
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId))

    const grants: Grants = {}
    for (const row of rows) {
      if (!grants[row.resource]) grants[row.resource] = []
      grants[row.resource].push(row.action)
    }
    return grants
  }

  async function replaceForRole(
    roleId: string,
    grants: Grants
  ): Promise<Grants> {
    await database.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))

      const rows = Object.entries(grants).flatMap(([resource, actions]) =>
        actions.map((action) => ({ roleId, resource, action }))
      )

      if (rows.length > 0) {
        await tx.insert(rolePermissions).values(rows)
      }
    })

    return getByRoleId(roleId)
  }

  async function hasPermission(
    roleId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: rolePermissions.id })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.resource, resource),
          eq(rolePermissions.action, action)
        )
      )
      .limit(1)
    return !!row
  }

  return { getByRoleId, replaceForRole, hasPermission }
}

export type PermissionsService = ReturnType<typeof createPermissionsService>
