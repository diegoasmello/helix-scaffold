import type { Page } from '@playwright/test'

import { expect, sampleFiles, signInAs, test, uniqueName } from './fixtures'
import { API_URL } from './stack'

// `todos` is the reference module, and this is the reference E2E spec of a
// module: it goes away with `todos` in an app built on the scaffold — copy
// its shape for the module that replaces it. What only a real browser and API
// can check: the uploads (multipart, image processing, the files served back),
// the rich text editor (TipTap does not run in jsdom) and a whole create →
// view → edit → delete cycle against the database. The admin runs it: an
// operator, so no subscription is needed.

test.describe('Todos', () => {
  // West of UTC, a calendar day sent as an instant at UTC midnight shows as
  // the day before: the dates below must come back as the day picked.
  test.use({ timezoneId: 'America/Sao_Paulo' })

  test('creates a todo with its files and shows it', async ({ page }) => {
    const title = uniqueName('Todo')

    await page.goto('/todos/create')
    await page.getByRole('textbox', { name: 'Title' }).fill(title)
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('Written by the E2E suite.')
    await page
      .getByRole('textbox', { name: 'Content' })
      .fill('Rich text typed in the editor.')
    await page.getByRole('textbox', { name: 'Date' }).fill('June 15, 2025')

    // Each upload field is a group named by its label; the file goes
    // straight to the API (`POST /uploads`) and comes back as a card
    await page
      .getByRole('group', { name: 'Image' })
      .locator('input[type=file]')
      .setInputFiles(sampleFiles.png)
    await expect(
      page.getByRole('button', { name: `Remove ${sampleFiles.png.name}` })
    ).toBeVisible()
    await page
      .getByRole('group', { name: 'Attachments' })
      .locator('input[type=file]')
      .setInputFiles(sampleFiles.txt)
    await expect(
      page.getByRole('button', { name: `Remove ${sampleFiles.txt.name}` })
    ).toBeVisible()
    await page
      .getByRole('group', { name: 'File (PDF)' })
      .locator('input[type=file]')
      .setInputFiles(sampleFiles.pdf)
    await expect(
      page.getByRole('button', { name: `Remove ${sampleFiles.pdf.name}` })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Todo created successfully')).toBeVisible()
    await expect(page).toHaveURL(/\/todos(\?|$)/)

    // The detail shows what was saved, with the files served back
    await page
      .getByRole('row')
      .filter({ hasText: title })
      .getByRole('button', { name: 'View', exact: true })
      .click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Rich text typed in the editor.')).toBeVisible()
    await expect(page.getByText('6/15/25')).toBeVisible()
    for (const file of [sampleFiles.png, sampleFiles.txt, sampleFiles.pdf]) {
      await expect(page.getByRole('link', { name: file.name })).toBeVisible()
    }
  })

  test('edits a todo', async ({ adminApi, page }) => {
    const todo = await adminApi.createTodo()
    const newTitle = uniqueName('Edited todo')

    await page.goto(`/todos/${todo.id}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const titleInput = page.getByRole('textbox', { name: 'Title' })
    await expect(titleInput).toHaveValue(todo.title)
    await titleInput.fill(newTitle)
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Todo updated successfully')).toBeVisible()
    await page.goto(`/todos/${todo.id}`)
    await expect(page.getByRole('heading', { name: newTitle })).toBeVisible()
  })

  test('deletes a todo only once confirmed', async ({ adminApi, page }) => {
    const todo = await adminApi.createTodo()
    const row = page.getByRole('row').filter({ hasText: todo.title })

    await page.goto('/todos')
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('Todo deleted successfully')).toBeVisible()
    await expect(row).toHaveCount(0)

    // Gone from the API too
    const res = await page.request.get(`${API_URL}/todos/${todo.id}`)
    expect(res.status()).toBe(404)
  })
})

// The plan gate across the web and the API, on the page of a module that
// requires a plan feature (`requireSubscription('todos')`, `feature: 'todos'`
// in its `PageAccess`): the entitlements the API computes
// (`GET /me/entitlements`) decide what the sidebar offers, where the guards
// send the user and what the API answers. RBAC is the other axis: every user
// here holds `todos:view`, so only the subscription decides. Plans (test
// config): `starter` unlocks nothing, `pro` unlocks `todos`. A module gated
// by its own feature copies this block.

// The list, or its empty state while no todo exists — other specs create
// todos in parallel, so either may show
function todosPage(page: Page) {
  return page.getByRole('heading', { name: /^(Todos|No todos yet)$/ })
}

test.describe('Todos — plan gate', () => {
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
