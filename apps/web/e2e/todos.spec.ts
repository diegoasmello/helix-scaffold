import { expect, sampleFiles, test, uniqueName } from './fixtures'
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
