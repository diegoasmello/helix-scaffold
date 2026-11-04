import type {
  PostRoles201,
  PostRolesMutationRequest,
  PostSubscriptions201,
  PostSubscriptionsMutationRequest,
  PostTodos201,
  PostTodosMutationRequest,
  PostUploads201,
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

/** Signs out through the account menu and waits for the login screen. */
export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login/)
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

  /**
   * An active subscription to `planId` for 30 days. The plans are the API
   * suite's (`apps/api/src/config/test-overrides.ts`): `starter` unlocks no
   * feature, `pro` and `enterprise` unlock `todos`.
   */
  async function createSubscription(
    userId: string,
    planId: 'starter' | 'pro' | 'enterprise' = 'pro',
    body: Partial<PostSubscriptionsMutationRequest> = {}
  ) {
    const now = Date.now()
    return send<PostSubscriptions201>('post', '/subscriptions', {
      userId,
      planId,
      status: 'active',
      currentPeriodStart: new Date(now).toISOString(),
      currentPeriodEnd: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...body,
    } satisfies PostSubscriptionsMutationRequest)
  }

  /** Uploads a file as the admin (`POST /uploads`, multipart). */
  async function createUpload(file: SampleFile) {
    const res = await request.post(`${API_URL}/uploads`, {
      multipart: { file },
    })
    expect(res.ok(), `POST /uploads: ${await res.text()}`).toBe(true)
    return (await res.json()) as PostUploads201
  }

  /** A todo with the image, PDF and attachment its form requires. */
  async function createTodo(body: Partial<PostTodosMutationRequest> = {}) {
    const [image, file, attachment] = await Promise.all([
      createUpload(sampleFiles.png),
      createUpload(sampleFiles.pdf),
      createUpload(sampleFiles.txt),
    ])
    return send<PostTodos201>('post', '/todos', {
      title: uniqueName('Todo'),
      description: 'Created by the E2E suite.',
      content: '<p>Created by the E2E suite.</p>',
      date: new Date().toISOString().slice(0, 10),
      imageId: image.id,
      fileId: file.id,
      attachmentIds: [attachment.id],
      ...body,
    } satisfies PostTodosMutationRequest)
  }

  return {
    createRole,
    createUser,
    createSubscription,
    createUpload,
    createTodo,
  }
}

/**
 * Files for upload fields (`locator.setInputFiles(sampleFiles.png)`), built
 * in memory so the suite has no binary fixtures. The PNG is a real 1×1 image:
 * the API turns images into WebP variants and rejects what it cannot read.
 */
interface SampleFile {
  name: string
  mimeType: string
  buffer: Buffer
}

export const sampleFiles = {
  png: {
    name: 'e2e-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    ),
  },
  pdf: {
    name: 'e2e-document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
    ),
  },
  txt: {
    name: 'e2e-notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Notes attached by the E2E suite.\n'),
  },
} satisfies Record<string, SampleFile>

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
