import { eq } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { user } from '@/db/schema'

import type { UpdateMeInput, UpdateMePasswordInput } from './me-schema'

export function createMeService(database: Database, auth: Auth) {
  async function getMe(userId: string) {
    const [item] = await database.select().from(user).where(eq(user.id, userId))
    return item ?? null
  }

  async function updateMe(userId: string, data: UpdateMeInput) {
    if (data.name !== undefined || data.email !== undefined) {
      await database.update(user).set(data).where(eq(user.id, userId))
    }
    return getMe(userId)
  }

  async function updatePassword(data: UpdateMePasswordInput, headers: Headers) {
    await auth.api.changePassword({
      headers,
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      },
    })
  }

  return { getMe, updateMe, updatePassword }
}

export type MeService = ReturnType<typeof createMeService>
