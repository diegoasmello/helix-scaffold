import { expect, test, uniqueName } from './fixtures'

// The audit log as the admin reads it: a change made in the UI is recorded by
// the API with its author and what was sent, and writes without a signed-in
// user are recorded under a system actor.

test.describe('Audit log', () => {
  test('a change made in the UI is logged with its author and what changed', async ({
    adminApi,
    page,
  }) => {
    const role = await adminApi.createRole()
    const newName = uniqueName('Renamed role')

    await page.goto(`/roles/${role.id}/edit`)
    await page.getByRole('textbox', { name: 'Name' }).fill(newName)
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('Renamed by the E2E suite.')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Role updated successfully')).toBeVisible()

    // Newest first; the page size keeps it on screen while other tests write
    await page.goto('/audit?pageSize=100')
    const entry = page
      .getByRole('row')
      .filter({ hasText: role.id })
      .filter({ has: page.getByText('Edit', { exact: true }) })
    await expect(entry).toHaveCount(1)
    await expect(entry).toContainText('E2E Admin')
    await expect(entry).toContainText('roles')

    await entry.getByRole('button', { name: 'View', exact: true }).click()
    await expect(page.getByText(newName)).toBeVisible()
  })

  test('the first admin is logged as created by the bootstrap', async ({
    page,
  }) => {
    // Oldest first: the database is emptied when the suite starts, so the
    // bootstrap's entry is the first one
    await page.goto('/audit?pageSize=10&sortBy=createdAt&sortOrder=asc')
    const first = page.getByRole('row').nth(1)
    await expect(first).toContainText('Bootstrap')
    await expect(first).toContainText('Create')
    await expect(first).toContainText('users')
  })
})
