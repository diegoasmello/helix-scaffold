import {
  createRole,
  getRolesAllHandler,
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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { CreateRoleInput } from '../types'
import { RoleSelectField } from './role-select-field'

const onChange = vi.fn()

const mockRoles = [
  createRole({ isAdmin: false, id: 'role-1', name: 'Admin' }),
  createRole({ isAdmin: false, id: 'role-2', name: 'Viewer' }),
]

function renderField(props: { allowCreate?: boolean; value?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <RoleSelectField onChange={onChange} {...props} />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(getRolesAllHandler(mockRoles))
})

afterEach(() => {
  vi.clearAllMocks()
  notifications.clean()
})

describe('RoleSelectField', () => {
  it('lists the roles from GET /roles/all', async () => {
    renderField()
    await userEvent.click(await screen.findByPlaceholderText('Pick one'))
    expect(
      await screen.findByRole('option', { name: 'Admin', hidden: true })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Viewer', hidden: true })
    ).toBeInTheDocument()
  })

  it('never offers the admin role', async () => {
    server.use(
      getRolesAllHandler([
        ...mockRoles,
        createRole({ isAdmin: true, id: 'role-admin', name: 'Administrator' }),
      ])
    )
    renderField()
    await userEvent.click(await screen.findByPlaceholderText('Pick one'))
    await screen.findByRole('option', { name: 'Viewer', hidden: true })
    expect(
      screen.queryByRole('option', { name: 'Administrator', hidden: true })
    ).not.toBeInTheDocument()
  })

  it('shows the selected role name', async () => {
    renderField({ value: 'role-2' })
    expect(await screen.findByPlaceholderText('Pick one')).toHaveValue('Viewer')
  })

  it('calls onChange with the role id when an option is picked', async () => {
    renderField()
    await userEvent.click(await screen.findByPlaceholderText('Pick one'))
    await userEvent.click(
      await screen.findByRole('option', { name: 'Admin', hidden: true })
    )
    expect(onChange).toHaveBeenCalledWith(
      'role-1',
      expect.objectContaining({ value: 'role-1', label: 'Admin' })
    )
  })

  it('does not offer inline creation by default', async () => {
    renderField()
    await screen.findByPlaceholderText('Pick one')
    expect(screen.queryByLabelText('Create role')).not.toBeInTheDocument()
  })

  describe('with allowCreate', () => {
    it('renders the create button', async () => {
      renderField({ allowCreate: true })
      expect(
        await screen.findByRole('button', { name: 'Create role' })
      ).toBeInTheDocument()
    })

    it('opens the create drawer when the button is clicked', async () => {
      renderField({ allowCreate: true })
      await userEvent.click(
        await screen.findByRole('button', { name: 'Create role' })
      )
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Create role')).toBeInTheDocument()
    })

    it('selects the newly created role and refreshes the options', async () => {
      const created = createRole({
        isAdmin: false,
        id: 'role-99',
        name: 'Editor',
        description: 'Can edit content',
      })
      server.use(
        postRolesHandler(async (info) => {
          const body = (await info.request.json()) as CreateRoleInput
          // The drawer invalidates /roles/all — return the new role from now on.
          server.use(getRolesAllHandler([...mockRoles, created]))
          return postRolesHandlerResponse201({ ...created, ...body })
        })
      )

      renderField({ allowCreate: true })
      await userEvent.click(
        await screen.findByRole('button', { name: 'Create role' })
      )
      const dialog = await screen.findByRole('dialog')
      await userEvent.type(
        within(dialog).getByPlaceholderText('Role name'),
        'Editor'
      )
      await userEvent.type(
        within(dialog).getByPlaceholderText('Role description'),
        'Can edit content'
      )
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Save' })
      )

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          'role-99',
          expect.objectContaining({ value: 'role-99' })
        )
      )
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      )

      await userEvent.click(screen.getByPlaceholderText('Pick one'))
      expect(
        await screen.findByRole('option', { name: 'Editor', hidden: true })
      ).toBeInTheDocument()
    })
  })
})
