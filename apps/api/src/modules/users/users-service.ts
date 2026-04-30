import { eq } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { roles, user } from '@/db/schema'

import type { CreateUserInput, UpdateUserInput } from './users-schema'

export function createUsersService(database: Database, auth: Auth) {
  async function list() {
    return database.select().from(user)
  }

  async function getById(id: string) {
    const [item] = await database.select().from(user).where(eq(user.id, id))
    return item ?? null
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

    const [item] = await database
      .update(user)
      .set(data)
      .where(eq(user.id, id))
      .returning()
    return item ?? null
  }

  async function remove(id: string) {
    await database.delete(user).where(eq(user.id, id))
  }

  return { list, getById, create, update, remove }
}

export type UsersService = ReturnType<typeof createUsersService>
