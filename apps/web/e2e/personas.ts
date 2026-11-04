// Accounts the setup creates. Other users are created per test (`adminApi`),
// with unique names, so tests never share them.

export interface Credentials {
  email: string
  password: string
}

/** The first admin, created through `POST /bootstrap` — holds the admin role. */
export const ADMIN = {
  name: 'E2E Admin',
  email: 'admin@e2e.example.com',
  password: 'e2e-admin-password',
} as const

/** The admin's session, saved by `global.setup.ts` — the default of every test. */
export const ADMIN_STATE = 'e2e/.auth/admin.json'
