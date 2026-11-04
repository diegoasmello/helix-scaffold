import { and, eq } from 'drizzle-orm'

import { isDeclaredPermission } from '@/config/permissions'
import type { Database } from '@/db'
import { rolePermissions } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'

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

      // Deduplicated: a repeated action would hit role_permissions_unique.
      const rows = Object.entries(grants).flatMap(([resource, actions]) =>
        [...new Set(actions)].map((action) => ({ roleId, resource, action }))
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

  /**
   * The role's grants as `resource:action` strings. Only catalog pairs count:
   * a leftover row for a removed resource gives no access (`requirePermission`
   * accepts declared pairs only), so it must not block anyone either.
   */
  async function grantsOf(roleId: string | null): Promise<Set<string>> {
    if (!roleId) return new Set()
    const grants = await getByRoleId(roleId)
    return new Set(
      Object.entries(grants).flatMap(([resource, actions]) =>
        actions
          .filter((action) => isDeclaredPermission(resource, action))
          .map((action) => `${resource}:${action}`)
      )
    )
  }

  /**
   * Privilege ceiling: whether `roleId` grants something the actor's own role
   * (`actorGrants`, from `grantsOf`) does not. Nobody hands out, or manages
   * someone holding, more than they have themselves.
   */
  async function exceeds(roleId: string | null, actorGrants: Set<string>) {
    for (const grant of await grantsOf(roleId)) {
      if (!actorGrants.has(grant)) return true
    }
    return false
  }

  /**
   * Refuses (403 `role_not_editable`) to let the actor manage a role that
   * grants something their own role lacks — its permissions, name, default
   * flag or existence: delegated moderators manage the roles below them, never
   * the admin's. Returns the actor's grants for further checks.
   */
  async function assertRoleManageable(
    roleId: string,
    actorRoleId: string | null
  ): Promise<Set<string>> {
    const actorGrants = await grantsOf(actorRoleId)
    if (await exceeds(roleId, actorGrants)) {
      throw new DomainError(
        403,
        'role_not_editable',
        'This role has permissions your own role lacks'
      )
    }
    return actorGrants
  }

  return {
    getByRoleId,
    replaceForRole,
    hasPermission,
    grantsOf,
    exceeds,
    assertRoleManageable,
  }
}
