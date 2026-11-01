import z from 'zod'

import {
  permissionActionSchema,
  permissionResourceSchema,
} from '@/config/permissions'

export const resourceDefinitionSchema = z
  .object({
    resource: permissionResourceSchema,
    label: z.string(),
    actions: z.array(permissionActionSchema),
  })
  .meta({ id: 'ResourceDefinition', title: 'ResourceDefinition' })

export const grantsSchema = z
  .record(z.string(), z.array(z.string()))
  .meta({ id: 'Grants', title: 'Grants' })

export const rolePermissionsResponseSchema = z
  .object({
    grants: grantsSchema,
  })
  .meta({ id: 'RolePermissionsResponse', title: 'RolePermissionsResponse' })

export type Grants = z.infer<typeof grantsSchema>
