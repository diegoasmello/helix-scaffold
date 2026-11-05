import type { Page } from '@playwright/test'

import { expect, signInAs, test } from './fixtures'

// Subscriptions across the web and the API, whichever modules a plan gates:
// the subscription the admin gives or changes is the one the user's profile
// shows. What a plan unlocks is checked on the page of a gated module (the
// `todos` spec → _plan gate_).

// The plan the catalog of `/me/subscription` marks as the user's
function currentPlan(page: Page) {
  return page
    .getByRole('region', { name: 'Plans' })
    .locator('[aria-current="true"]')
}

test.describe('Subscriptions', () => {
  test('the user sees the plan the admin gives, then the one they change it to', async ({
    adminApi,
    browser,
    page,
  }) => {
    const role = await adminApi.createRole()
    const user = await adminApi.createUser({ roleId: role.id })

    const userPage = await signInAs(browser, user)
    await userPage.goto('/me/subscription')
    await expect(
      userPage.getByRole('heading', { name: 'No active subscription' })
    ).toBeVisible()

    const subscription = await adminApi.createSubscription(user.id, 'starter')
    await userPage.reload()
    await expect(currentPlan(userPage)).toContainText('Starter')

    // The admin moves the subscription to Pro
    await page.goto(`/subscriptions/${subscription.id}/edit`)
    await page.getByRole('combobox', { name: 'Plan' }).click()
    await page.getByRole('option', { name: 'Pro', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByText('Subscription updated successfully')
    ).toBeVisible()

    await userPage.reload()
    await expect(currentPlan(userPage)).toContainText('Pro')

    await userPage.context().close()
  })
})
