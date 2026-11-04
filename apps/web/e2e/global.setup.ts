import type { GetBootstrapStatus200 } from '@helix/api-client/types'
import { expect, test as setup } from '@playwright/test'

import { signIn } from './fixtures'
import { ADMIN, ADMIN_STATE } from './personas'
import { API_URL } from './stack'

// Runs once before every project. The API empties its database when it starts
// (`pnpm --filter api e2e:server`), so this creates the first admin through
// the real `POST /bootstrap`. A server reused from an earlier run is already
// bootstrapped by this same admin: then it only signs in again.
setup('bootstrap and sign in the admin', async ({ page, request }) => {
  const status = await request.get(`${API_URL}/bootstrap/status`)
  expect(status.ok()).toBe(true)
  const { bootstrapped } = (await status.json()) as GetBootstrapStatus200

  if (!bootstrapped) {
    const res = await request.post(`${API_URL}/bootstrap`, { data: ADMIN })
    expect(res.status()).toBe(201)
  }

  await signIn(page, ADMIN)
  await page.context().storageState({ path: ADMIN_STATE })
})
