import type {
  PostRoles201,
  PostRolesMutationRequest,
  PostUsers201,
  PostUsersMutationRequest,
  PutRolesIdPermissionsMutationRequest,
} from '@helix/api-client/types'
import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  test as base,
} from '@playwright/test'

import { ADMIN_STATE, type Credentials } from './personas'
import { API_URL } from './stack'

/** `${prefix} 1a2b3c4d` — names never collide between tests or runs. */
export function uniqueName(prefix: string) {
  return `${prefix} ${crypto.randomUUID().slice(0, 8)}`
}

/** A fresh address on the same pattern as `uniqueName()`. */
export function uniqueEmail(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@e2e.example.com`
}

/** Signs in through the login screen and waits to leave it. */
export async function signIn(page: Page, credentials: Credentials) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(credentials.email)
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/**
 * A page in a new browser context — no session, not the admin's — signed in
 * as `credentials`. Close its context at the end of the test.
 */
export async function signInAs(browser: Browser, credentials: Credentials) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await signIn(page, credentials)
  return page
}

/**
 * The API as the admin, for the data a test needs before its journey starts.
 * The journey itself goes through the UI; this only sets the stage.
 * Bodies and responses are the generated contract types, so a change to the
 * API breaks these helpers at type-check, not at run time.
 */
function createAdminApi(request: APIRequestContext) {
  async function send<T>(
    method: 'post' | 'put',
    path: string,
    data: unknown
  ): Promise<T> {
    const res = await request[method](`${API_URL}${path}`, { data })
    expect(
      res.ok(),
      `${method.toUpperCase()} ${path}: ${await res.text()}`
    ).toBe(true)
    return (await res.json()) as T
  }

  /** A role with exactly `grants` (`{ users: ['view'] }`) — none by default. */
  async function createRole(
    grants: PutRolesIdPermissionsMutationRequest['grants'] = {},
    body: Partial<PostRolesMutationRequest> = {}
  ) {
    const role = await send<PostRoles201>('post', '/roles', {
      name: uniqueName('Role'),
      ...body,
    } satisfies PostRolesMutationRequest)
    if (Object.keys(grants).length > 0) {
      await send('put', `/roles/${role.id}/permissions`, {
        grants,
      } satisfies PutRolesIdPermissionsMutationRequest)
    }
    return role
  }

  /** A user who can sign in: the response plus the password it was given. */
  async function createUser(body: Partial<PostUsersMutationRequest> = {}) {
    const input = {
      name: uniqueName('User'),
      email: uniqueEmail('user'),
      password: 'e2e-user-password',
      ...body,
    } satisfies PostUsersMutationRequest
    const created = await send<PostUsers201>('post', '/users', input)
    return { ...created, password: input.password }
  }

  return { createRole, createUser }
}

interface Fixtures {
  adminApi: ReturnType<typeof createAdminApi>
}

/** Every spec imports `test` and `expect` from here, not from Playwright. */
export const test = base.extend<Fixtures>({
  // `provide` is Playwright's `use` — renamed so the React hooks lint rule
  // does not take it for React's `use()`
  adminApi: async ({ playwright }, provide) => {
    const request = await playwright.request.newContext({
      storageState: ADMIN_STATE,
    })
    await provide(createAdminApi(request))
    await request.dispose()
  },
})

export { expect }
