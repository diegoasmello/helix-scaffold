import z from 'zod'

export const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
})

export const updateMeEmailSchema = z.object({
  newEmail: z.email(),
  /** Required when the account has a password (credential account). */
  currentPassword: z.string().min(1).optional(),
})

export const updateMePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const setPasswordSchema = z.object({
  newPassword: z.string().min(8),
})

export type UpdateMeInput = z.infer<typeof updateMeSchema>
export type UpdateMeEmailInput = z.infer<typeof updateMeEmailSchema>
export type UpdateMePasswordInput = z.infer<typeof updateMePasswordSchema>
export type SetPasswordInput = z.infer<typeof setPasswordSchema>
