import {
  createRole,
  postRolesHandler,
  postRolesHandlerResponse201,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  Notifications,
  notifications,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { CreateRoleInput } from '../types'
import { RoleCreateDrawer } from './role-create-drawer'

const onClose = vi.fn()
const onSuccess = vi.fn()

function drawer(opened: boolean) {
  return (
    <RoleCreateDrawer opened={opened} onClose={onClose} onSuccess={onSuccess} />
  )
}

function renderDrawer(opened = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrap = (ui: ReactNode) => (
    <MantineProvider>
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
  const result = render(wrap(drawer(opened)))
  return {
    ...result,
    setOpened: (next: boolean) => result.rerender(wrap(drawer(next))),
  }
}

async function fillForm() {
  const dialog = await screen.findByRole('dialog')
  await userEvent.type(
    within(dialog).getByPlaceholderText('Role name'),
    'Editor'
  )
  await userEvent.type(
    within(dialog).getByPlaceholderText('Role description'),
    'Can edit content'
  )
  return dialog
}

beforeEach(() => {
  server.use(
    postRolesHandler(async (info) => {
      const body = (await info.request.json()) as CreateRoleInput
      return postRolesHandlerResponse201(createRole({ ...body, id: 'role-99' }))
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
  notifications.clean()
})

describe('RoleCreateDrawer', () => {
  it('renders nothing when closed', () => {
    renderDrawer(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the role form when opened', async () => {
    renderDrawer()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Create Role')).toBeInTheDocument()
    expect(within(dialog).getByPlaceholderText('Role name')).toBeInTheDocument()
    expect(
      within(dialog).getByPlaceholderText('Role description')
    ).toBeInTheDocument()
  })

  it('shows validation errors when submitting an empty form', async () => {
    renderDrawer()
    const dialog = await screen.findByRole('dialog')
    // Native `required` blocks a button-click submit in jsdom; submit directly
    // so the Mantine validators run.
    fireEvent.submit(dialog.querySelector('form')!)
    expect(await within(dialog).findAllByText('Required')).toHaveLength(2)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('calls POST /roles, then closes and reports the new role id', async () => {
    let capturedBody: CreateRoleInput | undefined
    server.use(
      postRolesHandler(async (info) => {
        capturedBody = (await info.request.json()) as CreateRoleInput
        return postRolesHandlerResponse201(
          createRole({ ...capturedBody, id: 'role-99' })
        )
      })
    )
    renderDrawer()
    const dialog = await fillForm()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('role-99'))
    expect(onClose).toHaveBeenCalled()
    expect(capturedBody).toEqual({
      name: 'Editor',
      description: 'Can edit content',
      isDefault: false,
    })
    expect(
      await screen.findByText('Role created successfully')
    ).toBeInTheDocument()
  })

  it('shows a danger notification and stays open when the API fails', async () => {
    server.use(
      postRolesHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )
    renderDrawer()
    const dialog = await fillForm()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Failed to create role')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose and resets the form on cancel', async () => {
    const { setOpened } = renderDrawer()
    const dialog = await fillForm()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    expect(onClose).toHaveBeenCalled()

    setOpened(false)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    setOpened(true)
    const reopened = await screen.findByRole('dialog')
    expect(within(reopened).getByPlaceholderText('Role name')).toHaveValue('')
    expect(
      within(reopened).getByPlaceholderText('Role description')
    ).toHaveValue('')
  })
})
