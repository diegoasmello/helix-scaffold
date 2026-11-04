import { expect, signIn, signInAs, signOut, test, uniqueName } from './fixtures'

// The profile (`/me`) needs a session and nothing else. Each test uses its own
// user: changing the password signs out every other session of the account,
// and the admin's session is shared by the whole suite.

test.describe('Profile', () => {
  test('renames the account', async ({ adminApi, browser }) => {
    const user = await adminApi.createUser()
    const newName = uniqueName('Renamed')

    const userPage = await signInAs(browser, user)
    await userPage.goto('/me/account')
    const nameSection = userPage.getByRole('region', { name: 'Name' })
    await nameSection.getByRole('textbox', { name: 'Name' }).fill(newName)
    await nameSection.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(userPage.getByText('Name updated successfully')).toBeVisible()

    // The header follows, and the API kept it
    const accountMenu = userPage.getByRole('button', { name: 'Account menu' })
    await expect(accountMenu).toContainText(newName)
    await userPage.reload()
    await expect(accountMenu).toContainText(newName)

    await userPage.context().close()
  })

  test('changes the password: only the new one signs in', async ({
    adminApi,
    browser,
  }) => {
    const user = await adminApi.createUser()
    const newPassword = 'e2e-new-password'

    const userPage = await signInAs(browser, user)
    await userPage.goto('/me/security')
    const passwordSection = userPage.getByRole('region', { name: 'Password' })
    await passwordSection
      .getByRole('textbox', { name: 'Current password' })
      .fill(user.password)
    await passwordSection
      .getByRole('textbox', { name: 'New password', exact: true })
      .fill(newPassword)
    await passwordSection
      .getByRole('textbox', { name: 'Confirm new password' })
      .fill(newPassword)
    await passwordSection
      .getByRole('button', { name: 'Change password' })
      .click()
    await expect(
      userPage.getByText('Password changed successfully')
    ).toBeVisible()

    await signOut(userPage)

    // The old password no longer works...
    await userPage.getByRole('textbox', { name: 'Email' }).fill(user.email)
    await userPage
      .getByRole('textbox', { name: 'Password', exact: true })
      .fill(user.password)
    await userPage.getByRole('button', { name: 'Sign in' }).click()
    await expect(userPage.getByText('Invalid credentials')).toBeVisible()

    // ...the new one does
    await signIn(userPage, { email: user.email, password: newPassword })

    await userPage.context().close()
  })
})
