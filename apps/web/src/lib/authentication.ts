import { createAuthClient } from 'better-auth/react'

import { API_URL } from '@/lib/api-url'

export const authClient = createAuthClient({
  // A base with a path is used as is: better-auth's routes are `/api/auth/*`.
  baseURL: `${API_URL}/auth`,
})
