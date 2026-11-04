import z from 'zod'

import type { Config } from '@/config'

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
] as const satisfies readonly ResourceDefinition[]

type Definitions = (typeof RESOURCE_DEFINITIONS)[number]

/** A resource the catalog declares. */
export type PermissionResource = Definitions['resource']

/**
 * Resources that exist only while a feature of `app.config.ts` is on. While it
 * is off, the role editor neither shows nor accepts them (`GET
 * /permissions/resources` leaves them out, `PUT /roles/:id/permissions`
 * refuses them), and the grants a role already holds are kept for when the
 * feature comes back. They stay in `RESOURCE_DEFINITIONS`, so the types and
 * `requirePermission()` do not depend on the configuration.
 */
const RESOURCE_TOGGLES: Partial<
  Record<PermissionResource, (config: Config) => boolean>
> = {
  subscriptions: (config) => config.subscriptions.enabled,
}

/** Whether `resource` is in use under `config` — see `RESOURCE_TOGGLES`. */
export function isResourceEnabled(resource: string, config: Config): boolean {
  // Own keys only: `'toString'` must not read `Object.prototype`.
  const toggle = Object.hasOwn(RESOURCE_TOGGLES, resource)
    ? RESOURCE_TOGGLES[resource as PermissionResource]
    : undefined
  return toggle ? toggle(config) : true
}

/** The catalog the role editor works with: `RESOURCE_DEFINITIONS` minus the resources turned off. */
export function enabledResourceDefinitions(config: Config) {
  return RESOURCE_DEFINITIONS.filter((def) =>
    isResourceEnabled(def.resource, config)
  )
}

/** The actions the catalog declares for `R` — `ResourceAction<'audit'>` is `'view'`. */
export type ResourceAction<R extends PermissionResource> = Extract<
  Definitions,
  { resource: R }
>['actions'][number]

/** A `resource:action` pair the catalog declares. */
export type Permission = {
  [R in PermissionResource]: { resource: R; action: ResourceAction<R> }
}[PermissionResource]

/** The same pair written `'resource:action'` — `'todos:view'`. */
type PermissionKey = {
  [R in PermissionResource]: `${R}:${ResourceAction<R>}`
}[PermissionResource]

/**
 * Permissions that only work together with others: `'users:edit'` needs
 * `'users:view'` (the edit page loads the user) and `'roles:view'` (its role
 * select reads `GET /roles/all`). Declare a requirement when, without it, the
 * permission's page does not load or cannot finish its main task — the record
 * it loads, a required field fed by another module's route (a select, a
 * required upload). An optional action inside the page is not one: editing a
 * todo works with the files it has, so `todos:edit` does not need
 * `uploads:create`, and a role may edit todos without uploading files.
 *
 * Served with the catalog (`GET /permissions/resources` → `requires`): the
 * permission editor checks the requirements along with a permission and
 * unchecks what depends on one it unchecks. `PUT /roles/:id/permissions`
 * refuses grants that leave one out (400 `missing_required_permissions`).
 * Direct requirements only — `permissions:edit` → `permissions:view` →
 * `roles:view` chains on its own.
 */
const PERMISSION_REQUIREMENTS: Partial<
  Record<PermissionKey, readonly PermissionKey[]>
> = {
  // Image, file and one attachment are required on create.
  'todos:create': ['todos:view', 'uploads:create'],
  'todos:edit': ['todos:view'],
  'todos:delete': ['todos:view'],

  'users:create': ['users:view', 'roles:view'],
  'users:edit': ['users:view', 'roles:view'],
  'users:delete': ['users:view'],

  'roles:create': ['roles:view'],
  'roles:edit': ['roles:view'],
  'roles:delete': ['roles:view'],

  // A role's permissions are shown and edited only on the role's own pages.
  'permissions:view': ['roles:view'],
  'permissions:edit': ['permissions:view'],

  'subscriptions:create': ['subscriptions:view', 'users:view'],
  'subscriptions:edit': ['subscriptions:view'],
  'subscriptions:delete': ['subscriptions:view'],
}

/**
 * Requirements (`'from → to'`) that point at a resource of `RESOURCE_TOGGLES`
 * from another resource — `'users:edit': ['subscriptions:view']`. While the
 * setting is off, `from` could never be granted: the editor would ask for a
 * checkbox it does not show and the `PUT` would refuse it. Only the
 * resource's own actions may require one of its pairs
 * (`subscriptions:create` → `subscriptions:view`); a toggled resource may
 * require an always-on one (`subscriptions:create` → `users:view`).
 */
export function findRequirementsOnToggledResources(
  requirements: Partial<Record<string, readonly string[]>>,
  toggled: readonly string[]
): string[] {
  const resourceOf = (key: string) => key.split(':')[0]
  return Object.entries(requirements).flatMap(([from, required = []]) =>
    required
      .filter(
        (to) =>
          toggled.includes(resourceOf(to)) &&
          resourceOf(to) !== resourceOf(from)
      )
      .map((to) => `${from} → ${to}`)
  )
}

// Checked once, when the catalog loads: a wrong requirement stops the API
// (and the tests) at startup.
const requirementsOnToggled = findRequirementsOnToggledResources(
  PERMISSION_REQUIREMENTS,
  Object.keys(RESOURCE_TOGGLES)
)
if (requirementsOnToggled.length > 0) {
  throw new Error(
    `PERMISSION_REQUIREMENTS: a permission cannot require a resource of RESOURCE_TOGGLES other than its own (src/config/permissions.ts): ${requirementsOnToggled.join(', ')}`
  )
}

function toPermission(key: PermissionKey): Permission {
  const [resource, action] = key.split(':')
  return { resource, action } as Permission
}

/** `requires` of `GET /permissions/resources`: each action's direct requirements. */
export function directRequirementsOf(
  resource: PermissionResource
): Record<string, Permission[]> {
  return Object.fromEntries(
    Object.entries(PERMISSION_REQUIREMENTS)
      .filter(([key]) => key.startsWith(`${resource}:`))
      .map(([key, required]) => [
        key.slice(resource.length + 1),
        required.map(toPermission),
      ])
  )
}

/**
 * `resource:action` pairs that `grants` needs (`PERMISSION_REQUIREMENTS`) but
 * does not hold. Empty when every grant comes with its requirements.
 */
export function findMissingRequirements(
  grants: Record<string, string[]>
): string[] {
  const held = new Set(
    Object.entries(grants).flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}:${action}`)
    )
  )
  const missing = [...held].flatMap(
    (key) =>
      PERMISSION_REQUIREMENTS[key as PermissionKey]?.filter(
        (required) => !held.has(required)
      ) ?? []
  )
  return [...new Set(missing)]
}

type GrantMap = Record<string, string[]>

const pairsOf = (grants: GrantMap) =>
  Object.entries(grants).flatMap(([resource, actions]) =>
    actions.map((action) => `${resource}:${action}`)
  )

function grantsFrom(pairs: Iterable<string>): GrantMap {
  const grants: GrantMap = {}
  for (const key of pairs) {
    const [resource, action] = key.split(':')
    grants[resource] = [...(grants[resource] ?? []), action]
  }
  return grants
}

/**
 * Splits `kept` into the grants whose requirements `grants` plus what remains
 * of `kept` still meet, and the `dropped` rest. Dropped until none is left,
 * since a kept grant may require another. The role editor does the same with
 * what it shows — unchecking a requirement unchecks what depends on it — for
 * grants it does not show: those of a resource turned off.
 */
export function dropUnmetRequirements(
  grants: GrantMap,
  kept: GrantMap
): { kept: GrantMap; dropped: GrantMap } {
  const given = new Set(pairsOf(grants))
  const remaining = new Set(pairsOf(kept))
  const dropped: string[] = []
  const held = (key: string) => given.has(key) || remaining.has(key)

  let changed = true
  while (changed) {
    changed = false
    for (const key of remaining) {
      const required = PERMISSION_REQUIREMENTS[key as PermissionKey] ?? []
      if (required.some((pair) => !held(pair))) {
        remaining.delete(key)
        dropped.push(key)
        changed = true
      }
    }
  }

  return { kept: grantsFrom(remaining), dropped: grantsFrom(dropped) }
}

export const permissionResourceSchema = z
  .enum(RESOURCE_DEFINITIONS.map((def) => def.resource))
  .meta({ id: 'PermissionResource', title: 'PermissionResource' })

// TypeScript can't pair each resource with its own actions through flatMap.
export const ALL_PERMISSIONS = RESOURCE_DEFINITIONS.flatMap(
  ({ resource, actions }) =>
    actions.map((action: PermissionAction) => ({ resource, action }))
) as Permission[]

/** True when the catalog declares `action` on `resource`. */
export function isDeclaredPermission(
  resource: string,
  action: string
): boolean {
  const definition = RESOURCE_DEFINITIONS.find(
    (def) => def.resource === resource
  )
  const declared: readonly string[] = definition?.actions ?? []
  return declared.includes(action)
}

/**
 * `resource:action` pairs in `grants` that `RESOURCE_DEFINITIONS` does not
 * declare. Empty when every grant is known.
 */
export function findUnknownGrants(grants: Record<string, string[]>): string[] {
  return Object.entries(grants).flatMap(([resource, actions]) =>
    actions
      .filter((action) => !isDeclaredPermission(resource, action))
      .map((action) => `${resource}:${action}`)
  )
}

/**
 * `resource:action` pairs in `grants` of resources turned off under `config`
 * (`RESOURCE_TOGGLES`). Empty when every grant's resource is in use.
 */
export function findDisabledGrants(grants: GrantMap, config: Config): string[] {
  return pairsOf(onlyDisabledResources(grants, config))
}

/** `grants` without the resources turned off under `config`. */
export function withoutDisabledResources<G extends GrantMap>(
  grants: G,
  config: Config
): G {
  return Object.fromEntries(
    Object.entries(grants).filter(([resource]) =>
      isResourceEnabled(resource, config)
    )
  ) as G
}

/** Only the grants of the resources turned off under `config`. */
export function onlyDisabledResources<G extends GrantMap>(
  grants: G,
  config: Config
): G {
  return Object.fromEntries(
    Object.entries(grants).filter(
      ([resource]) => !isResourceEnabled(resource, config)
    )
  ) as G
}
