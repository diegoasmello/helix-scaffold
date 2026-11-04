import { expect, signInAs, test, uniqueEmail, uniqueName } from './fixtures'

// RBAC across the web and the API: what the admin grants in the permission
// editor is what the user then sees, reaches and is refused. Each layer is
// tested on its own (API route tests, MSW screen tests); this checks they agree.

const SIDEBAR_PAGES = ['Todos', 'Users', 'Roles', 'Audit log', 'Subscriptions']

test.describe('RBAC', () => {
  test('a role granted in the editor opens exactly its pages to its user', async ({
    adminApi,
    browser,
    page,
  }) => {
    const role = await adminApi.createRole()

    // The admin grants Users › View and Audit log › View in the editor
    await page.goto(`/roles/${role.id}/permissions`)
    await page
      .getByRole('group', { name: 'Users' })
      .getByRole('checkbox', { name: 'View' })
      .check()
    await page
      .getByRole('group', { name: 'Audit log' })
      .getByRole('checkbox', { name: 'View' })
      .check()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Permissions saved successfully')).toBeVisible()

    // ...and creates a user with that role
    const user = {
      name: uniqueName('Auditor'),
      email: uniqueEmail('auditor'),
      password: 'e2e-auditor-password',
    }
    await page.goto('/users/create')
    await page.getByRole('textbox', { name: 'Name' }).fill(user.name)
    await page.getByRole('textbox', { name: 'Email' }).fill(user.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(user.password)
    await page.getByRole('combobox', { name: 'Role' }).fill(role.name)
    await page.getByRole('option', { name: role.name }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL(/\/users(\?|$)/)

    // The user lands on the first page the role opens, and the sidebar offers
    // only what it grants
    const userPage = await signInAs(browser, user)
    await expect(userPage).toHaveURL(/\/users(\?|$)/)
    await expect(userPage.getByRole('heading', { name: 'Users' })).toBeVisible()
    for (const label of SIDEBAR_PAGES) {
      const link = userPage.getByRole('link', { name: label, exact: true })
      if (label === 'Users' || label === 'Audit log') {
        await expect(link).toBeVisible()
      } else {
        await expect(link).toHaveCount(0)
      }
    }

    // Reading is all the role allows: no Create button, and the rows offer
    // View alone
    const ownRow = userPage.getByRole('row').filter({ hasText: user.email })
    await expect(
      ownRow.getByRole('button', { name: 'View', exact: true })
    ).toBeVisible()
    await expect(
      ownRow.getByRole('button', { name: 'Edit', exact: true })
    ).toHaveCount(0)
    await expect(
      ownRow.getByRole('button', { name: 'Delete', exact: true })
    ).toHaveCount(0)
    await expect(
      userPage.getByRole('button', { name: 'Create', exact: true })
    ).toHaveCount(0)

    // A page it does not grant is refused by URL too
    await userPage.goto('/roles')
    await expect(userPage).toHaveURL(/\/403$/)

    await userPage.context().close()
  })

  test('a user whose role grants nothing lands on the profile', async ({
    adminApi,
    browser,
  }) => {
    const role = await adminApi.createRole()
    const user = await adminApi.createUser({ roleId: role.id })

    const userPage = await signInAs(browser, user)
    await expect(userPage).toHaveURL(/\/me\/account$/)
    for (const label of SIDEBAR_PAGES) {
      await expect(
        userPage.getByRole('link', { name: label, exact: true })
      ).toHaveCount(0)
    }

    await userPage.context().close()
  })

  test('the editor checks what a permission requires, and the API keeps it', async ({
    adminApi,
    page,
  }) => {
    const role = await adminApi.createRole()

    await page.goto(`/roles/${role.id}/permissions`)
    const users = page.getByRole('group', { name: 'Users' })
    await users.getByRole('checkbox', { name: 'Edit' }).check()
    await expect(
      page.getByText('Also checked: Users › View, Roles › View')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Permissions saved successfully')).toBeVisible()

    // What was saved is what the API returns on a fresh load
    await page.reload()
    await expect(users.getByRole('checkbox', { name: 'View' })).toBeChecked()
    await expect(users.getByRole('checkbox', { name: 'Edit' })).toBeChecked()
    await expect(
      page
        .getByRole('group', { name: 'Roles' })
        .getByRole('checkbox', { name: 'View' })
    ).toBeChecked()
    await expect(
      users.getByRole('checkbox', { name: 'Create' })
    ).not.toBeChecked()
  })
})
