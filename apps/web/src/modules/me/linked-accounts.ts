import { queryOptions } from '@tanstack/react-query'

import { authClient } from '../../lib/authentication'
import type { LinkedAccount } from './types'

/**
 * The user's sign-in methods (`providerId: 'credential'` = has a password).
 * `MeAccount`, `PasswordSection` and `SignInMethods` share it — one request.
 */
export const linkedAccountsQuery = queryOptions({
  queryKey: ['me', 'accounts'] as const,
  queryFn: async () => {
    const { data, error } = await authClient.listAccounts()
    // Better Auth returns { error } instead of throwing
    if (error) throw error
    return (data ?? []) as LinkedAccount[]
  },
})
