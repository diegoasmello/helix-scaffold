import { asc, count, desc, eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { roles, user } from '@/db/schema'
import { getPaginationParams } from '@/lib/pagination'

import type {
  CreateRoleInput,
  RolesListQuery,
  UpdateRoleInput,
} from './roles-schema'

const SORT_COLUMNS = {
  name: roles.name,
  createdAt: roles.createdAt,
} as const

export function createRolesService(database: Database) {
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

  async function hasUsers(id: string) {
    const [found] = await database
      .select({ id: user.id })
      .from(user)
      .where(eq(user.roleId, id))
      .limit(1)
    return !!found
  }

  async function create(data: CreateRoleInput) {
    const [role] = await database.insert(roles).values(data).returning()
    return role
  }

  async function update(id: string, data: UpdateRoleInput) {
    const [role] = await database
      .update(roles)
      .set(data)
      .where(eq(roles.id, id))
      .returning()
    return role ?? null
  }

  async function remove(id: string) {
    await database.delete(roles).where(eq(roles.id, id))
  }

  return { list, listAll, getById, hasUsers, create, update, remove }
}

export type RolesService = ReturnType<typeof createRolesService>
