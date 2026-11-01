import {
  getMeEntitlementsQueryOptions,
  getSubscriptionStatusQueryOptions,
} from '@helix/api-client/hooks'
import { useQuery } from '@tanstack/react-query'
import { parseISO } from 'date-fns'

import { hasSubscriptionAccess } from '../access'

export function useSubscriptionAccess() {
  const { data: status, isPending: statusPending } = useQuery({
    ...getSubscriptionStatusQueryOptions(),
    staleTime: Infinity,
  })
  const enabled = status?.enabled ?? false

  const { data, isPending: entitlementsPending } = useQuery({
    ...getMeEntitlementsQueryOptions(),
    enabled,
  })

  // React Query v5 reports isPending=true for disabled queries that never fetched.
  const isPending = statusPending || (enabled && entitlementsPending)
  const entitlements = enabled ? (data ?? null) : null

  /** See `hasSubscriptionAccess` in `../access.ts` for the rules. */
  const hasAccess = (feature?: string) =>
    hasSubscriptionAccess({ enabled, entitlements }, feature)

  // When a past_due subscription loses access (end of the grace period).
  const graceEndsAt = entitlements?.graceEndsAt
    ? parseISO(entitlements.graceEndsAt)
    : null

  return { hasAccess, graceEndsAt, isPending }
}
