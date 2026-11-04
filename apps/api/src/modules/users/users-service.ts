import { asc, count, desc, eq } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Config } from '@/config'
import type { Database } from '@/db'
import { roles, user } from '@/db/schema'
import { DomainError } from '@/lib/domain-errors'
import { getPaginationParams } from '@/lib/pagination'
import {
  getPgErrorCode,
  getPgErrorConstraint,
  PG_UNIQUE_VIOLATION,
} from '@/lib/pg-errors'
import {
  createAccountProvisioning,
  EmailTakenError,
  RoleNotFoundError,
} from '@/modules/accounts/account-provisioning'
import { createPermissionsService } from '@/modules/permissions/permissions-service'

import type {
  CreateUserInput,
  UpdateUserInput,
  UsersListQuery,
} from './users-schema'

const SORT_COLUMNS = {
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
} as const

function roleNotAssignable() {
  return new DomainError(
    403,
    'role_not_assignable',
    'This role grants permissions your own role lacks'
  )
}

function toUserWithRole(row: {
  id: string
  name: string
  email: string
  emailVerified: boolean
  roleId: string | null
  createdAt: Date
  updatedAt: Date
  roleRefId: string | null
  roleName: string | null
}) {
  const { roleRefId, roleName, ...rest } = row
  return {
    ...rest,
    role: roleRefId ? { id: roleRefId, name: roleName! } : null,
  }
}

/** One user with their role's id and name — also `GET /me`'s answer. */
export async function getUserWithRole(database: Database, id: string) {
  const [row] = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      roleId: user.roleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roleRefId: roles.id,
      roleName: roles.name,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(eq(user.id, id))
  return row ? toUserWithRole(row) : null
}

export function createUsersService(
  database: Database,
  auth: Auth,
  config: Pick<Config, 'registration'>
) {
  const provisioning = createAccountProvisioning(database, auth, config)

  const { grantsOf, exceeds } = createPermissionsService(database)

  async function list(query: UsersListQuery) {
    const { limit, offset } = getPaginationParams(query.page, query.pageSize)
    const sortCol = SORT_COLUMNS[query.sortBy ?? 'createdAt']
    const sortFn = query.sortOrder === 'desc' ? desc : asc
    const [rows, [{ total }]] = await Promise.all([
      database
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          roleId: user.roleId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          roleRefId: roles.id,
          roleName: roles.name,
        })
        .from(user)
        .leftJoin(roles, eq(user.roleId, roles.id))
        .orderBy(sortFn(sortCol))
        .limit(limit)
        .offset(offset),
      database.select({ total: count() }).from(user),
    ])
    return { data: rows.map(toUserWithRole), total }
  }

  async function getById(id: string) {
    return getUserWithRole(database, id)
  }

  async function validateRoleExists(roleId: string) {
    const [role] = await database
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.id, roleId))
    return !!role
  }

  /**
   * Throws `RoleNotFoundError` for an unknown `roleId` — see account
   * provisioning — and a 403 `role_not_assignable` when the role grants
   * something the actor's role does not (checked first: nothing is written).
   */
  async function create(data: CreateUserInput, actorRoleId: string | null) {
    if (
      data.roleId &&
      (await exceeds(data.roleId, await grantsOf(actorRoleId)))
    ) {
      throw roleNotAssignable()
    }
    return getById(await provisioning.provisionAccount(data))
  }

  /**
   * Privilege ceiling — only when the request really changes the role or the
   * email (the edit form re-sends both unchanged, so a name-only edit passes):
   * the target's current role must not exceed the actor's (403
   * `user_not_editable` — no rewriting a higher account's email, no demoting
   * it), and neither may the new role (403 `role_not_assignable`).
   */
  async function update(
    id: string,
    data: UpdateUserInput,
    actorRoleId: string | null
  ) {
    if (data.roleId) {
      const roleExists = await validateRoleExists(data.roleId)
      if (!roleExists) throw new RoleNotFoundError()
    }

    const [target] = await database
      .select({ email: user.email, roleId: user.roleId })
      .from(user)
      .where(eq(user.id, id))
    if (!target) return null

    const roleChanged =
      data.roleId !== undefined && data.roleId !== target.roleId
    const emailChanged =
      data.email !== undefined &&
      data.email.toLowerCase() !== target.email.toLowerCase()

    if (roleChanged || emailChanged) {
      const actorGrants = await grantsOf(actorRoleId)
      if (await exceeds(target.roleId, actorGrants)) {
        throw new DomainError(
          403,
          'user_not_editable',
          'This user has permissions your own role lacks'
        )
      }
      if (roleChanged && (await exceeds(data.roleId ?? null, actorGrants))) {
        throw roleNotAssignable()
      }
    }

    const [updated] = await database
      .update(user)
      .set(data)
      .where(eq(user.id, id))
      .returning({ id: user.id })
      .catch((error: unknown) => {
        if (
          getPgErrorCode(error) === PG_UNIQUE_VIOLATION &&
          getPgErrorConstraint(error) === 'user_email_unique'
        ) {
          throw new EmailTakenError()
        }
        throw error
      })
    if (!updated) return null
    return getById(id)
  }

  /** Deletes the row; `false` when the id did not exist (nothing to audit). */
  async function remove(id: string): Promise<boolean> {
    const deleted = await database
      .delete(user)
      .where(eq(user.id, id))
      .returning({ id: user.id })
    return deleted.length > 0
  }

  async function listAll() {
    const rows = await database
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        roleId: user.roleId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleRefId: roles.id,
        roleName: roles.name,
      })
      .from(user)
      .leftJoin(roles, eq(user.roleId, roles.id))
      .orderBy(asc(user.name))
    return rows.map(toUserWithRole)
  }

  return { list, getById, create, update, remove, listAll }
}
