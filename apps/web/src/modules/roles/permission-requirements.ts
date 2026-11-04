import type {
  PermissionAction,
  PermissionRef,
  PermissionResource,
  ResourceDefinition,
} from '@helix/api-client/types'

import type { AuthState } from '../auth/types'

/** `{ [resource]: action[] }` — the grants the permission editor holds. */
export type EditorGrants = Record<string, PermissionAction[]>

/**
 * Whether the signed-in user may hand out a permission: their own role holds
 * it — `useAuth().hasPermission`, or `createPermissionChecker()` over
 * `GET /me/permissions`.
 */
export type CanGrant = AuthState['hasPermission']

type Key = `${string}:${string}`

const keyOf = (resource: string, action: string): Key => `${resource}:${action}`

const refOf = (key: Key): PermissionRef => {
  const [resource, action] = key.split(':')
  return { resource, action } as PermissionRef
}

/** What the catalog's `requires` implies, worked out once per catalog. */
interface CatalogGraph {
  /** Every `resource:action` of the catalog, in its order. */
  keys: PermissionRef[]
  /** Each pair to its direct requirements. */
  direct: Map<Key, Key[]>
  /** Each pair to its requirements, transitively, in catalog order. */
  requires: Map<Key, PermissionRef[]>
  /** Each pair to what needs it, transitively, in catalog order. */
  dependents: Map<Key, PermissionRef[]>
}

// One graph per catalog: the array comes from the query cache, so the same
// catalog is the same array across renders and calls.
const graphsByCatalog = new WeakMap<ResourceDefinition[], CatalogGraph>()

function graphOf(definitions: ResourceDefinition[]): CatalogGraph {
  let graph = graphsByCatalog.get(definitions)
  if (!graph) {
    graph = buildGraph(definitions)
    graphsByCatalog.set(definitions, graph)
  }
  return graph
}

function buildGraph(definitions: ResourceDefinition[]): CatalogGraph {
  const keys = definitions.flatMap((def) =>
    def.actions.map(
      (action) => ({ resource: def.resource, action }) as PermissionRef
    )
  )
  const direct = new Map<Key, Key[]>(
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
  const graph: CatalogGraph = {
    keys,
    direct,
    requires: new Map(),
    dependents: new Map(),
  }
  // In catalog order, so each dependents list comes out in that order too.
  for (const ref of keys) {
    const key = keyOf(ref.resource, ref.action)
    for (const required of transitiveRequirements(graph, key)) {
      const requiredKey = keyOf(required.resource, required.action)
      graph.dependents.set(requiredKey, [
        ...(graph.dependents.get(requiredKey) ?? []),
        ref,
      ])
    }
  }
  return graph
}

/** `start`'s requirements, transitively, memoized in `graph.requires`. */
function transitiveRequirements(
  graph: CatalogGraph,
  start: Key
): PermissionRef[] {
  const cached = graph.requires.get(start)
  if (cached) return cached
  const found = new Set<Key>()
  const pending = [...(graph.direct.get(start) ?? [])]
  while (pending.length > 0) {
    const key = pending.shift()!
    if (key === start || found.has(key)) continue
    found.add(key)
    pending.push(...(graph.direct.get(key) ?? []))
  }
  const refs = [...found].map(refOf)
  graph.requires.set(start, refs)
  return refs
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
  return transitiveRequirements(graphOf(definitions), keyOf(resource, action))
}

/**
 * The permissions that need `resource:action`, transitively (`roles:view` →
 * `roles:edit`, `permissions:view`, `permissions:edit`), in catalog order —
 * what unchecking it unchecks too. Empty when nothing needs it.
 */
export function dependentsOf(
  definitions: ResourceDefinition[],
  resource: string,
  action: string
): PermissionRef[] {
  return graphOf(definitions).dependents.get(keyOf(resource, action)) ?? []
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
  const { direct } = graphOf(definitions)
  const holding = held(grants)
  const revoked = new Set(actions.map((action) => keyOf(resource, action)))

  let grew = true
  while (grew) {
    grew = false
    for (const key of holding) {
      if (revoked.has(key)) continue
      if (direct.get(key)?.some((required) => revoked.has(required))) {
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

/**
 * Whether the editor may check `resource:action`: the user's role must hold it
 * and everything it requires, since checking it checks those too — the API
 * refuses any grant beyond the user's own role (`permissions_not_grantable`).
 */
export function isGrantable(
  definitions: ResourceDefinition[],
  canGrant: CanGrant,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  return (
    canGrant(resource, action) &&
    requirementsOf(definitions, resource, action).every((ref) =>
      canGrant(ref.resource, ref.action)
    )
  )
}

/** `def`'s actions that `grants` lacks and the user may grant (`isGrantable`), in catalog order. */
export function ungrantedActions(
  grants: EditorGrants,
  definitions: ResourceDefinition[],
  canGrant: CanGrant,
  def: ResourceDefinition
): PermissionAction[] {
  const current = grants[def.resource] ?? []
  return def.actions.filter(
    (action) =>
      !current.includes(action) &&
      isGrantable(definitions, canGrant, def.resource, action)
  )
}

/** A permission `grants` lacks although held permissions (`neededBy`) require it. */
export interface MissingRequirement {
  permission: PermissionRef
  neededBy: PermissionRef[]
}

/**
 * The requirements `grants` lacks, transitively, in catalog order — what the
 * API would answer `missing_required_permissions` for. Grants saved before a
 * requirement existed load like this.
 */
export function missingRequirements(
  grants: EditorGrants,
  definitions: ResourceDefinition[]
): MissingRequirement[] {
  const { keys } = graphOf(definitions)
  const holding = held(grants)
  const neededBy = new Map<Key, PermissionRef[]>()
  for (const ref of keys) {
    if (!holding.has(keyOf(ref.resource, ref.action))) continue
    for (const required of requirementsOf(
      definitions,
      ref.resource,
      ref.action
    )) {
      const key = keyOf(required.resource, required.action)
      if (holding.has(key)) continue
      neededBy.set(key, [...(neededBy.get(key) ?? []), ref])
    }
  }
  return keys.flatMap((permission) => {
    const by = neededBy.get(keyOf(permission.resource, permission.action))
    return by ? [{ permission, neededBy: by }] : []
  })
}

/**
 * What `next` checks and unchecks beyond what `before` did, other than the
 * permissions the user clicked (`clicked`) — the requirements and dependents
 * the editor moved along with them, in catalog order.
 */
export function cascadeOf(
  before: EditorGrants,
  next: EditorGrants,
  definitions: ResourceDefinition[],
  clicked: { resource: string; actions: readonly string[] }
): { granted: PermissionRef[]; revoked: PermissionRef[] } {
  const was = held(before)
  const is = held(next)
  const others = graphOf(definitions).keys.filter(
    (ref) =>
      ref.resource !== clicked.resource || !clicked.actions.includes(ref.action)
  )
  return {
    granted: others.filter(
      (ref) =>
        is.has(keyOf(ref.resource, ref.action)) &&
        !was.has(keyOf(ref.resource, ref.action))
    ),
    revoked: others.filter(
      (ref) =>
        was.has(keyOf(ref.resource, ref.action)) &&
        !is.has(keyOf(ref.resource, ref.action))
    ),
  }
}

/** How many `resource:action` pairs differ between `a` and `b`. */
export function countChanges(a: EditorGrants, b: EditorGrants): number {
  const left = held(a)
  const right = held(b)
  let count = 0
  for (const key of left) if (!right.has(key)) count++
  for (const key of right) if (!left.has(key)) count++
  return count
}
