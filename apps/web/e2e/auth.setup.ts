import { expect, test as setup } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

// Signs in once and saves the session so every E2E test starts authenticated.
// The user must already exist in the dev database (e.g. the admin created via /bootstrap).
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set in apps/web/.env'
    )
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).not.toHaveURL(/\/login/)

  await page.context().storageState({ path: authFile })
})
