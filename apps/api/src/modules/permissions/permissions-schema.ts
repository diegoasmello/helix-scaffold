import z from 'zod'

import {
  permissionActionSchema,
  permissionResourceSchema,
} from '@/config/permissions'

const permissionRefSchema = z
  .object({
    resource: permissionResourceSchema,
    action: permissionActionSchema,
  })
  .meta({ id: 'PermissionRef', title: 'PermissionRef' })

export const resourceDefinitionSchema = z
  .object({
    resource: permissionResourceSchema,
    label: z.string(),
    actions: z.array(permissionActionSchema),
    requires: z
      .record(z.string(), z.array(permissionRefSchema))
      .describe(
        "Each action's direct requirements — `{ edit: [{ resource: 'users', action: 'view' }] }`. An action without requirements has no key."
      ),
  })
  .meta({ id: 'ResourceDefinition', title: 'ResourceDefinition' })

const grantsSchema = z
  .record(z.string(), z.array(z.string()))
  .meta({ id: 'Grants', title: 'Grants' })

export const rolePermissionsResponseSchema = z
  .object({
    grants: grantsSchema,
  })
  .meta({ id: 'RolePermissionsResponse', title: 'RolePermissionsResponse' })

export type Grants = z.infer<typeof grantsSchema>
