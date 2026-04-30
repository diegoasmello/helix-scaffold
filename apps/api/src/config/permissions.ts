import z from 'zod'

export const permissionActionSchema = z
  .enum(['view', 'create', 'edit', 'delete'])
  .meta({ id: 'PermissionAction', title: 'PermissionAction' })

export type PermissionAction = z.infer<typeof permissionActionSchema>

interface ResourceDefinition {
  resource: string
  label: string
  actions: readonly PermissionAction[]
}

export const RESOURCE_DEFINITIONS = [
  {
    resource: 'users',
    label: 'Users',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    resource: 'roles',
    label: 'Roles',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    resource: 'permissions',
    label: 'Permissions',
    actions: ['view', 'edit'],
  },
] satisfies readonly ResourceDefinition[]

export const ALL_PERMISSIONS = RESOURCE_DEFINITIONS.flatMap(
  ({ resource, actions }) => actions.map((action) => ({ resource, action }))
)
