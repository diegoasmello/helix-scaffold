import { type QueryClient, useQueryClient } from '@tanstack/react-query'

/**
 * The cached queries each resource owns, and the other queries that show its
 * data. Every query `@helix/api-client` generates is keyed
 * `[{ url, params? }, query?]`: a resource owns every URL under its path —
 * the paginated list (`/roles`), the select-field list (`/roles/all`), the
 * detail (`/roles/:id`) and sub-resources (`/roles/:id/permissions`).
 */
const RESOURCES = {
  todos: { path: '/todos', shownBy: [] },
  // A user's role decides the signed-in user's own permissions.
  users: { path: '/users', shownBy: ['/me/permissions'] },
  // Users embed their role's name; a role's grants are someone's permissions.
  roles: { path: '/roles', shownBy: ['/users', '/me/permissions'] },
  // The admin may be editing their own subscription.
  subscriptions: {
    path: '/subscriptions',
    shownBy: ['/me/subscription', '/me/entitlements'],
  },
} as const satisfies Record<string, { path: string; shownBy: string[] }>

export type CachedResource = keyof typeof RESOURCES

type QueryKey = readonly unknown[]

function urlOf(queryKey: QueryKey): string | undefined {
  const [first] = queryKey
  return typeof first === 'object' && first !== null && 'url' in first
    ? String((first as { url: unknown }).url)
    : undefined
}

function isUnder(url: string, path: string) {
  return url === path || url.startsWith(`${path}/`)
}

/** Every query the resource owns or that shows its data. */
function isStaleAfterChange(resource: CachedResource, queryKey: QueryKey) {
  const url = urlOf(queryKey)
  if (!url) return false
  const { path, shownBy } = RESOURCES[resource]
  return [path, ...shownBy].some((prefix) => isUnder(url, prefix))
}

/** The detail query key, as generated: `[{ url: '/roles/:id', params: { id } }]`. */
export function detailQueryKey(resource: CachedResource, id: string) {
  return [{ url: `${RESOURCES[resource].path}/:id`, params: { id } }] as const
}

function sameKey(a: QueryKey, b: QueryKey) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Cache bookkeeping after a mutation. Call it from `useMutation`'s
 * `onSuccess`; the mutation itself stays inline in the component.
 */
export function createResourceCache(queryClient: QueryClient) {
  /** Something about `resource` changed (e.g. a create): refetch all its lists, details and dependents. */
  function changed(resource: CachedResource) {
    return queryClient.invalidateQueries({
      predicate: (query) => isStaleAfterChange(resource, query.queryKey),
    })
  }

  /** One item was updated: seed its detail with the response, refetch everything else. */
  function saved(resource: CachedResource, item: { id: string }) {
    const detail = detailQueryKey(resource, item.id)
    queryClient.setQueryData(detail, item)
    return queryClient.invalidateQueries({
      predicate: (query) =>
        !sameKey(query.queryKey, detail) &&
        isStaleAfterChange(resource, query.queryKey),
    })
  }

  /** One item was deleted: drop its cached detail (and sub-resources), refetch everything else. */
  function removed(resource: CachedResource, id: string) {
    const prefix = `${RESOURCES[resource].path}/:id`
    queryClient.removeQueries({
      predicate: (query) => {
        const url = urlOf(query.queryKey)
        const params = (query.queryKey[0] as { params?: { id?: unknown } })
          ?.params
        return !!url && isUnder(url, prefix) && params?.id === id
      },
    })
    return changed(resource)
  }

  return { changed, saved, removed }
}

export type ResourceCache = ReturnType<typeof createResourceCache>

export function useResourceCache(): ResourceCache {
  return createResourceCache(useQueryClient())
}
