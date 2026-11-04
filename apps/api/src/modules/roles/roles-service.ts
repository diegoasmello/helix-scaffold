import { asc, count, desc, eq, sql } from 'drizzle-orm'

import type { Database } from '@/db'
import { roles, user } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'
import { getPaginationParams } from '@/lib/pagination'
import {
  getPgErrorCode,
  getPgErrorConstraint,
  PG_UNIQUE_VIOLATION,
} from '@/lib/pg-errors'
import { createPermissionsService } from '@/modules/permissions/permissions-service'

import type {
  CreateRoleInput,
  RolesListQuery,
  UpdateRoleInput,
} from './roles-schema'

/** `roles.name` is unique: another role already has this name. */
function nameTaken(error: unknown): never {
  if (
    getPgErrorCode(error) === PG_UNIQUE_VIOLATION &&
    getPgErrorConstraint(error) === 'roles_name_unique'
  ) {
    throw new DomainError(
      409,
      'name_taken',
      'A role with this name already exists'
    )
  }
  throw error
}

const SORT_COLUMNS = {
  name: roles.name,
  createdAt: roles.createdAt,
} as const

export function createRolesService(database: Database) {
  const { assertRoleManageable, isRoleManageable } =
    createPermissionsService(database)

  async function list(query: RolesListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const [data, [{ total }]] = await Promise.all([
      database
        .select()
        .from(roles)
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(roles),
    ])
    return { data, total }
  }

  async function listAll() {
    return database.select().from(roles).orderBy(asc(roles.name))
  }

  async function getById(id: string) {
    const [role] = await database.select().from(roles).where(eq(roles.id, id))
    return role ?? null
  }

  /**
   * The role with `manageable`: whether the actor may change it — see
   * `isRoleManageable()`. `null` when the id does not exist.
   */
  async function getDetail(id: string, actorRoleId: string | null) {
    const role = await getById(id)
    if (!role) return null
    return { ...role, manageable: await isRoleManageable(id, actorRoleId) }
  }

  async function hasUsers(id: string) {
    const [found] = await database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.roleId, id))
      .limit(1)
    return !!found
  }

  /** Throws `name_taken` (409) for a duplicate name. */
  async function create(data: CreateRoleInput) {
    return database
      .transaction(async (tx) => {
        if (data.isDefault) {
          await tx
            .update(roles)
            .set({ isDefault: false })
            .where(sql`is_default = true`)
        }
        const [role] = await tx.insert(roles).values(data).returning()
        return role
      })
      .catch(nameTaken)
  }

  /**
   * Throws `name_taken` (409) for a duplicate name, `admin_role_locked` (403)
   * for the admin role and `role_not_editable` (403) for a role granting
   * something the actor's own role lacks — see `assertRoleManageable()`.
   */
  async function update(
    id: string,
    data: UpdateRoleInput,
    actorRoleId: string | null
  ) {
    await assertRoleManageable(id, actorRoleId)
    return database
      .transaction(async (tx) => {
        if (data.isDefault) {
          await tx
            .update(roles)
            .set({ isDefault: false })
            .where(sql`is_default = true`)
        }
        const [role] = await tx
          .update(roles)
          .set(data)
          .where(eq(roles.id, id))
          .returning()
        return role ?? null
      })
      .catch(nameTaken)
  }

  /**
   * Deletes the row; `false` when the id did not exist (nothing to audit).
   * Refuses (409) the default registration role (`default_role`) and a role
   * that still has users (`role_in_use`), and (403) the admin role
   * (`admin_role_locked`) and a role granting something the actor's own role
   * lacks (`role_not_editable`).
   */
  async function remove(
    id: string,
    actorRoleId: string | null
  ): Promise<boolean> {
    await assertRoleManageable(id, actorRoleId)
    const role = await getById(id)
    if (role?.isDefault) {
      throw new DomainError(
        409,
        'default_role',
        'Cannot delete the default registration role'
      )
    }
    if (await hasUsers(id)) {
      throw new DomainError(
        409,
        'role_in_use',
        'Cannot delete a role that has assigned users'
      )
    }
    const deleted = await database
      .delete(roles)
      .where(eq(roles.id, id))
      .returning({ id: roles.id })
    return deleted.length > 0
  }

  return {
    list,
    listAll,
    getById,
    getDetail,
    hasUsers,
    create,
    update,
    remove,
  }
}
