import { and, eq, isNotNull, or } from 'drizzle-orm'

import { ALL_PERMISSIONS, isDeclaredPermission } from '@/config/permissions'
import type { Database } from '@/db'
import { rolePermissions, roles } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'

import type { Grants } from './permissions-schema'

/** The whole catalog as `Grants` — what the admin role holds. */
function allGrants(): Grants {
  const grants: Grants = {}
  for (const { resource, action } of ALL_PERMISSIONS) {
    grants[resource] = [...(grants[resource] ?? []), action]
  }
  return grants
}

export function createPermissionsService(database: Database) {
  /** Whether `roleId` is the admin role (`roles.isAdmin`). */
  async function isAdminRole(roleId: string | null): Promise<boolean> {
    if (!roleId) return false
    const [row] = await database
      .select({ isAdmin: roles.isAdmin })
      .from(roles)
      .where(eq(roles.id, roleId))
    return row?.isAdmin ?? false
  }

  /**
   * The role's grants. The admin role holds the whole catalog, whatever
   * `role_permissions` says — a module added later is the admin's at once.
   */
  async function getByRoleId(roleId: string): Promise<Grants> {
    if (await isAdminRole(roleId)) return allGrants()

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
    // One query: the admin role passes on any catalog pair, the others need
    // the row.
    const adminPasses = isDeclaredPermission(resource, action)
    const [row] = await database
      .select({ id: roles.id })
      .from(roles)
      .leftJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleId, roles.id),
          eq(rolePermissions.resource, resource),
          eq(rolePermissions.action, action)
        )
      )
      .where(
        and(
          eq(roles.id, roleId),
          or(
            adminPasses ? eq(roles.isAdmin, true) : undefined,
            isNotNull(rolePermissions.id)
          )
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
   * Refuses to let the actor manage a role — its permissions, name, default
   * flag or existence: the admin role is locked for everyone, the admin
   * included (403 `admin_role_locked`), and a role granting something the
   * actor's own role lacks is out of reach (403 `role_not_editable`):
   * delegated moderators manage the roles below them. Returns the actor's
   * grants for further checks.
   */
  async function assertRoleManageable(
    roleId: string,
    actorRoleId: string | null
  ): Promise<Set<string>> {
    if (await isAdminRole(roleId)) {
      throw new DomainError(
        403,
        'admin_role_locked',
        'The admin role cannot be changed'
      )
    }
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
    isAdminRole,
    getByRoleId,
    replaceForRole,
    hasPermission,
    grantsOf,
    exceeds,
    assertRoleManageable,
  }
}
