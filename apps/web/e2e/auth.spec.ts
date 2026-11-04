import {
  expect,
  signIn,
  signOut,
  test,
  uniqueEmail,
  uniqueName,
} from './fixtures'

// The session across the web and better-auth: signing in and out, the guards
// without a session, self-registration (open in the test config) and a
// session that ends in another tab.

test.describe('Auth', () => {
  // Every test here starts signed out
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a page behind the session sends a signed-out visitor to the login', async ({
    page,
  }) => {
    await page.goto('/users')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('a wrong password keeps the user on the login screen', async ({
    adminApi,
    page,
  }) => {
    const user = await adminApi.createUser()

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
    await page
      .getByRole('textbox', { name: 'Password', exact: true })
      .fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid credentials')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('signing up opens an account with the default role', async ({
    page,
  }) => {
    const name = uniqueName('Newcomer')

    await page.goto('/sign-up')
    await page.getByRole('textbox', { name: 'Name' }).fill(name)
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill(uniqueEmail('newcomer'))
    await page
      .getByRole('textbox', { name: 'Password', exact: true })
      .fill('e2e-newcomer-password')
    await page
      .getByRole('textbox', { name: 'Confirm password' })
      .fill('e2e-newcomer-password')
    await page.getByRole('button', { name: 'Create account' }).click()

    // The bootstrap's default role grants nothing, so only the profile opens
    await expect(page).toHaveURL(/\/me\/account$/)
    await expect(
      page.getByRole('button', { name: 'Account menu' })
    ).toContainText(name)
  })

  test('signing out ends the session', async ({ adminApi, page }) => {
    const user = await adminApi.createUser()

    await signIn(page, user)
    await signOut(page)

    await page.goto('/me')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('signing out in another tab signs this one out too', async ({
    adminApi,
    context,
    page,
  }) => {
    const role = await adminApi.createRole({ users: ['view'] })
    const user = await adminApi.createUser({ roleId: role.id })

    await signIn(page, user)
    await expect(page).toHaveURL(/\/users(\?|$)/)

    // Same browser, another tab: they share the session cookie
    const otherTab = await context.newPage()
    await otherTab.goto('/me')
    await signOut(otherTab)

    // better-auth tells the other tabs; the AuthGuard leaves without a click
    await expect(page).toHaveURL(/\/login$/)
  })
})
