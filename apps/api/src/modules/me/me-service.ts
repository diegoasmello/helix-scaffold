import { eq } from 'drizzle-orm'

import type { Auth } from '@/auth'
import type { Database } from '@/db'
import { user } from '@/db/schema'
import { env } from '@/env'
import type { EmailProvider } from '@/lib/email'

import type {
  SetPasswordInput,
  UpdateMeEmailInput,
  UpdateMeInput,
  UpdateMePasswordInput,
} from './me-schema'

export function createMeService(
  database: Database,
  auth: Auth,
  emailProvider: EmailProvider
) {
  async function getMe(userId: string) {
    const [item] = await database.select().from(user).where(eq(user.id, userId))
    return item ?? null
  }

  async function updateMe(userId: string, data: UpdateMeInput) {
    if (data.name !== undefined) {
      await database.update(user).set(data).where(eq(user.id, userId))
    }
    return getMe(userId)
  }

  async function changeEmail(data: UpdateMeEmailInput, headers: Headers) {
    await auth.api.changeEmail({
      headers,
      body: {
        newEmail: data.newEmail,
        callbackURL: `${env.CLIENT_URL}/me/account`,
      },
    })
  }

  async function updatePassword(
    data: UpdateMePasswordInput,
    headers: Headers,
    userEmail: string
  ) {
    await auth.api.changePassword({
      headers,
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      },
    })

    emailProvider
      .send(
        userEmail,
        'Your password was changed',
        `<p>Your account password was successfully changed.</p>
         <p>If you did not make this change, please contact your system administrator immediately.</p>`
      )
      .catch(() => {})
  }

  async function setPassword(
    data: SetPasswordInput,
    headers: Headers,
    userEmail: string
  ) {
    await auth.api.setPassword({
      headers,
      body: { newPassword: data.newPassword },
    })

    emailProvider
      .send(
        userEmail,
        'A password was added to your account',
        `<p>A password has been set on your account.</p>
         <p>If you did not make this change, please contact your system administrator immediately.</p>`
      )
      .catch(() => {})
  }

  return { getMe, updateMe, changeEmail, updatePassword, setPassword }
}

export type MeService = ReturnType<typeof createMeService>
