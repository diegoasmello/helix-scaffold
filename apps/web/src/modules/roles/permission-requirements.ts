import type {
  PermissionAction,
  PermissionRef,
  ResourceDefinition,
} from '@helix/api-client/types'

/** `{ [resource]: action[] }` — the grants the permission editor holds. */
type EditorGrants = Record<string, PermissionAction[]>

type Key = `${string}:${string}`

const keyOf = (resource: string, action: string): Key => `${resource}:${action}`

// One map per catalog: the array comes from the query cache, so the same
// catalog is the same array across renders and calls.
const mapsByCatalog = new WeakMap<ResourceDefinition[], Map<Key, Key[]>>()

/** Each `resource:action` to its direct requirements, from the catalog's `requires`. */
function requirementsMap(definitions: ResourceDefinition[]): Map<Key, Key[]> {
  let map = mapsByCatalog.get(definitions)
  if (!map) {
    map = buildRequirementsMap(definitions)
    mapsByCatalog.set(definitions, map)
  }
  return map
}

function buildRequirementsMap(
  definitions: ResourceDefinition[]
): Map<Key, Key[]> {
  return new Map(
    definitions.flatMap((def) =>
      Object.entries(def.requires).map(
        ([action, required]) =>
          [
            keyOf(def.resource, action),
            required.map((ref: PermissionRef) =>
              keyOf(ref.resource, ref.action)
            ),
          ] as const
      )
    )
  )
}

function held(grants: EditorGrants): Set<Key> {
  return new Set(
    Object.entries(grants).flatMap(([resource, actions]) =>
      actions.map((action) => keyOf(resource, action))
    )
  )
}

/**
 * The permissions `resource:action` needs, transitively — what the editor
 * checks along with it (`permissions:edit` → `permissions:view` →
 * `roles:view`), in the order the catalog declares them. Empty when it needs
 * nothing.
 */
export function requirementsOf(
  definitions: ResourceDefinition[],
  resource: string,
  action: string
): PermissionRef[] {
  const map = requirementsMap(definitions)
  const start = keyOf(resource, action)
  const found = new Set<Key>()
  const pending = [...(map.get(start) ?? [])]
  while (pending.length > 0) {
    const key = pending.shift()!
    if (key === start || found.has(key)) continue
    found.add(key)
    pending.push(...(map.get(key) ?? []))
  }
  return [...found].map((key) => {
    const [res, act] = key.split(':')
    return { resource: res, action: act } as PermissionRef
  })
}

/**
 * Grants `actions` on `resource` and everything they require, appended after
 * the actions already held.
 */
export function grantWithRequirements(
  grants: EditorGrants,
  definitions: ResourceDefinition[],
  resource: string,
  actions: readonly PermissionAction[]
): EditorGrants {
  const next: EditorGrants = { ...grants }
  const add = (res: string, act: PermissionAction) => {
    const current = next[res] ?? []
    if (!current.includes(act)) next[res] = [...current, act]
  }
  for (const action of actions) {
    add(resource, action)
    for (const required of requirementsOf(definitions, resource, action)) {
      add(required.resource, required.action)
    }
  }
  return next
}

/**
 * Revokes `actions` on `resource` and every held permission that needs one of
 * them, transitively — unchecking `roles:view` also unchecks `roles:edit`,
 * `permissions:view` and `permissions:edit`.
 */
export function revokeWithDependents(
  grants: EditorGrants,
  definitions: ResourceDefinition[],
  resource: string,
  actions: readonly PermissionAction[]
): EditorGrants {
  const map = requirementsMap(definitions)
  const holding = held(grants)
  const revoked = new Set(actions.map((action) => keyOf(resource, action)))

  let grew = true
  while (grew) {
    grew = false
    for (const key of holding) {
      if (revoked.has(key)) continue
      if (map.get(key)?.some((required) => revoked.has(required))) {
        revoked.add(key)
        grew = true
      }
    }
  }

  const next: EditorGrants = { ...grants }
  for (const [res, acts] of Object.entries(grants)) {
    if (acts.some((act) => revoked.has(keyOf(res, act)))) {
      next[res] = acts.filter((act) => !revoked.has(keyOf(res, act)))
    }
  }
  return next
}
