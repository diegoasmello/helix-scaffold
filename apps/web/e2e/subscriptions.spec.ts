import type { Page } from '@playwright/test'

import { expect, signInAs, test } from './fixtures'
import { API_URL } from './stack'

// Subscription gating across the web and the API: the entitlements the API
// computes (`GET /me/entitlements`) decide what the sidebar offers, where the
// guards send the user and what the API answers. RBAC is the other axis: every
// user here holds `todos:view`, so only the subscription decides.
// Plans (test config): `starter` unlocks nothing, `pro` unlocks `todos`.

// The list, or its empty state while no todo exists — other specs create
// todos in parallel, so either may show
function todosPage(page: Page) {
  return page.getByRole('heading', { name: /^(Todos|No todos yet)$/ })
}

test.describe('Subscriptions', () => {
  test('without a subscription the user is asked to subscribe', async ({
    adminApi,
    browser,
  }) => {
    const role = await adminApi.createRole({ todos: ['view'] })
    const user = await adminApi.createUser({ roleId: role.id })

    const userPage = await signInAs(browser, user)
    // Todos is the only page the role opens, and the plan gate hides it
    await expect(userPage).toHaveURL(/\/me\/account$/)
    await expect(
      userPage.getByRole('link', { name: 'Todos', exact: true })
    ).toHaveCount(0)

    await userPage.goto('/todos')
    await expect(userPage).toHaveURL(/\/upgrade\?feature=todos$/)
    await expect(
      userPage.getByRole('heading', { name: 'Subscription required' })
    ).toBeVisible()

    // The API gives the same answer, before the permission is even checked
    const res = await userPage.request.get(`${API_URL}/todos`)
    expect(res.status()).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'subscription_required' })

    await userPage.context().close()
  })

  test('a plan without the feature is refused until the admin changes it', async ({
    adminApi,
    browser,
    page,
  }) => {
    const role = await adminApi.createRole({ todos: ['view'] })
    const user = await adminApi.createUser({ roleId: role.id })
    const subscription = await adminApi.createSubscription(user.id, 'starter')

    const userPage = await signInAs(browser, user)
    await userPage.goto('/todos')
    await expect(userPage).toHaveURL(/\/upgrade\?feature=todos$/)
    await expect(
      userPage.getByRole('heading', { name: 'Upgrade your plan' })
    ).toBeVisible()

    // The admin moves the subscription to Pro
    await page.goto(`/subscriptions/${subscription.id}/edit`)
    await page.getByRole('combobox', { name: 'Plan' }).click()
    await page.getByRole('option', { name: 'Pro', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText('Subscription updated successfully')
    ).toBeVisible()

    // On their next load the user reaches Todos, and the sidebar offers it
    await userPage.goto('/todos')
    await expect(userPage).toHaveURL(/\/todos(\?|$)/)
    await expect(todosPage(userPage)).toBeVisible()
    await expect(
      userPage.getByRole('link', { name: 'Todos', exact: true })
    ).toBeVisible()

    await userPage.context().close()
  })

  test('an operator reaches gated pages without a subscription', async ({
    adminApi,
    browser,
  }) => {
    // `subscriptions:view` makes the role an operator: never blocked by plans
    const role = await adminApi.createRole({
      todos: ['view'],
      subscriptions: ['view'],
    })
    const user = await adminApi.createUser({ roleId: role.id })

    const userPage = await signInAs(browser, user)
    // Todos is first in the sidebar, so `/` lands there
    await expect(userPage).toHaveURL(/\/todos(\?|$)/)
    await expect(todosPage(userPage)).toBeVisible()

    await userPage.context().close()
  })
})
