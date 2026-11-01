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
    resource: 'todos',
    label: 'Todos',
    actions: ['view', 'create', 'edit', 'delete'],
  },
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
  {
    resource: 'audit',
    label: 'Audit',
    actions: ['view'],
  },
  {
    resource: 'uploads',
    label: 'Uploads',
    actions: ['view', 'create', 'delete'],
  },
  {
    resource: 'subscriptions',
    label: 'Subscriptions',
    actions: ['view', 'create', 'edit', 'delete'],
  },
] satisfies readonly ResourceDefinition[]

export const ALL_PERMISSIONS = RESOURCE_DEFINITIONS.flatMap(
  ({ resource, actions }) => actions.map((action) => ({ resource, action }))
)

/**
 * `resource:action` pairs in `grants` that `RESOURCE_DEFINITIONS` does not
 * declare. Empty when every grant is known.
 */
export function findUnknownGrants(grants: Record<string, string[]>): string[] {
  return Object.entries(grants).flatMap(([resource, actions]) => {
    const definition = RESOURCE_DEFINITIONS.find(
      (def) => def.resource === resource
    )
    const declared: readonly string[] = definition?.actions ?? []
    return actions
      .filter((action) => !declared.includes(action))
      .map((action) => `${resource}:${action}`)
  })
}
