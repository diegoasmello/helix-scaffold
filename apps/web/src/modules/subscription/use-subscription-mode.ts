import { getSubscriptionStatusQueryOptions } from '@helix/api-client/hooks'
import { useQuery } from '@tanstack/react-query'

export function useSubscriptionMode() {
  const { data, isPending } = useQuery({
    ...getSubscriptionStatusQueryOptions(),
    staleTime: Infinity,
  })

  return {
    enabled: data?.enabled ?? false,
    isPending,
  }
}
