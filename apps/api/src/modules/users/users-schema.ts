import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  roleId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const userWithRoleSchema = userSchema
  .extend({
    role: z.object({ id: z.string(), name: z.string() }).nullable(),
  })
  .meta({ id: 'UserWithRole', title: 'UserWithRole' })

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  roleId: z.string().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  roleId: z.string().nullable().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const USER_SORT_COLUMNS = ['name', 'email', 'createdAt'] as const
export type UserSortColumn = (typeof USER_SORT_COLUMNS)[number]

export const usersSortingSchema = sortingQuerySchema([...USER_SORT_COLUMNS])
export const usersListQuerySchema = paginationQuerySchema.merge(usersSortingSchema)
export type UsersListQuery = z.infer<typeof usersListQuerySchema>

export const paginatedUsersSchema = paginatedResponseSchema(userWithRoleSchema).meta({
  id: 'PaginatedUsers',
  title: 'PaginatedUsers',
})
export type PaginatedUsers = z.infer<typeof paginatedUsersSchema>
