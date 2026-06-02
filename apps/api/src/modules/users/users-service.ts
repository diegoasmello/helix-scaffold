import { asc, count, desc, eq } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { roles, user } from '@/db/schema'
import { getPaginationParams } from '@/lib/pagination'

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

export function createUsersService(database: Database, auth: Auth) {
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

  async function validateRoleExists(roleId: string) {
    const [role] = await database
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.id, roleId))
    return !!role
  }

  async function create(data: CreateUserInput) {
    if (data.roleId) {
      const roleExists = await validateRoleExists(data.roleId)
      if (!roleExists)
        throw Object.assign(new Error('Role not found'), {
          code: 'ROLE_NOT_FOUND',
        })
    }

    const result = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
    })

    if (data.roleId) {
      await database
        .update(user)
        .set({ roleId: data.roleId })
        .where(eq(user.id, result.user.id))
    }

    return getById(result.user.id)
  }

  async function update(id: string, data: UpdateUserInput) {
    if (data.roleId) {
      const roleExists = await validateRoleExists(data.roleId)
      if (!roleExists)
        throw Object.assign(new Error('Role not found'), {
          code: 'ROLE_NOT_FOUND',
        })
    }

    const [updated] = await database
      .update(user)
      .set(data)
      .where(eq(user.id, id))
      .returning({ id: user.id })
    if (!updated) return null
    return getById(id)
  }

  async function remove(id: string) {
    await database.delete(user).where(eq(user.id, id))
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

export type UsersService = ReturnType<typeof createUsersService>
