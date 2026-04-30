import z from 'zod'

export const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
})

export const updateMePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export type UpdateMeInput = z.infer<typeof updateMeSchema>
export type UpdateMePasswordInput = z.infer<typeof updateMePasswordSchema>
