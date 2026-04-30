import { eq } from 'drizzle-orm'

import type { Database } from '@/db'
import { roles, user } from '@/db/schema'

import type { CreateRoleInput, UpdateRoleInput } from './roles-schema'

export function createRolesService(database: Database) {
  async function list() {
    return database.select().from(roles)
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

  return { list, getById, hasUsers, create, update, remove }
}

export type RolesService = ReturnType<typeof createRolesService>
