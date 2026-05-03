import z from 'zod'

import {
  paginatedResponseSchema,
  paginationQuerySchema,
} from '@/lib/pagination'
import { sortingQuerySchema } from '@/lib/sorting'

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
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(300).optional(),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(300).optional(),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

export const ROLE_SORT_COLUMNS = ['name', 'createdAt'] as const
export type RoleSortColumn = (typeof ROLE_SORT_COLUMNS)[number]

export const rolesSortingSchema = sortingQuerySchema([...ROLE_SORT_COLUMNS])
export const rolesListQuerySchema =
  paginationQuerySchema.merge(rolesSortingSchema)
export type RolesListQuery = z.infer<typeof rolesListQuerySchema>

export const paginatedRolesSchema = paginatedResponseSchema(roleSchema).meta({
  id: 'PaginatedRoles',
  title: 'PaginatedRoles',
})
export type PaginatedRoles = z.infer<typeof paginatedRolesSchema>
