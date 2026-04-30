import z from 'zod'

export const roleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({ id: 'Role', title: 'Role' })

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
