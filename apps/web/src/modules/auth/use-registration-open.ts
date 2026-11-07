import { getRegistrationStatusQueryOptions } from '@helix/api-client/hooks'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

/**
 * `GET /registration/status` with the session-long cache the registration
 * mode deserves — it only changes with `app.config.ts`, which restarts the API.
 * Loaders prefetch it with the same options so the first render already knows.
 */
export function registrationStatusQueryOptions() {
  return { ...getRegistrationStatusQueryOptions(), staleTime: Infinity }
}

/**
 * Whether self-registration is open. `false` while loading, so what only
 * matters to open registration (the default role) never flashes in closed mode.
 */
export function useRegistrationOpen() {
  const { data } = useQuery(registrationStatusQueryOptions())

  return data?.open ?? false
}

/**
 * Whether the API sends email (`email.enabled`). Without it there is no
 * password reset and only the admin changes their own email — the screens
 * show `ContactAdminModal` instead. Suspends until the status is known
 * (loaders prefetch it with `registrationStatusQueryOptions()`).
 */
export function useEmailEnabled() {
  const { data } = useSuspenseQuery(registrationStatusQueryOptions())

  return data.email
}
