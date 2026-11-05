import { expect, signInAs, test, uniqueEmail, uniqueName } from './fixtures'
import { API_URL } from './stack'

// RBAC across the web and the API: what the admin grants in the permission
// editor is what the user then sees, reaches and is refused. Each layer is
// tested on its own (API route tests, MSW screen tests); this checks they agree.

const SIDEBAR_PAGES = ['Users', 'Roles', 'Audit log', 'Subscriptions']

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

  // Privilege ceiling: nobody grants, or manages a role holding, more than
  // their own role has — the editor disables it and the API refuses it.
  test('a moderator grants only what their own role holds', async ({
    adminApi,
    browser,
  }) => {
    const moderatorRole = await adminApi.createRole({
      roles: ['view', 'edit'],
      permissions: ['view', 'edit'],
    })
    const moderator = await adminApi.createUser({ roleId: moderatorRole.id })
    const below = await adminApi.createRole()
    const above = await adminApi.createRole({ users: ['view'] })

    const modPage = await signInAs(browser, moderator)

    // In the editor: what the moderator's role lacks cannot be checked...
    await modPage.goto(`/roles/${below.id}/permissions`)
    await expect(
      modPage
        .getByRole('group', { name: 'Users' })
        .getByRole('checkbox', { name: 'View' })
    ).toBeDisabled()

    // ...what it holds can, and saves
    await modPage
      .getByRole('group', { name: 'Roles' })
      .getByRole('checkbox', { name: 'View' })
      .check()
    await modPage.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      modPage.getByText('Permissions saved successfully')
    ).toBeVisible()

    // The API refuses the grant the editor disabled, with the same session
    const refused = await modPage.request.put(
      `${API_URL}/roles/${below.id}/permissions`,
      { data: { grants: { users: ['view'] } } }
    )
    expect(refused.status()).toBe(403)
    expect(await refused.json()).toMatchObject({
      code: 'permissions_not_grantable',
    })

    // A role above the moderator's is read-only, and says why
    await modPage.goto(`/roles/${above.id}`)
    await expect(modPage.getByText('Above your role')).toBeVisible()
    await expect(
      modPage.getByRole('button', { name: 'Edit permissions', exact: true })
    ).toHaveCount(0)
    await modPage.goto(`/roles/${above.id}/permissions`)
    await expect(modPage).toHaveURL(new RegExp(`/roles/${above.id}$`))

    await modPage.context().close()
  })
})
