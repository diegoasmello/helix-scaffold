import {
  createRolePermissionsResponse,
  getMePermissionsHandler,
  getPermissionsResourcesHandler,
  getRolesIdPermissionsHandler,
  putRolesIdPermissionsHandler,
  putRolesIdPermissionsHandlerResponse200,
} from '@helix/api-client/mocks'
import type {
  PutRolesIdPermissionsMutationRequest,
  ResourceDefinition,
} from '@helix/api-client/types'
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
import { RolesPermissions } from './roles-permissions'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  rolesPermissionsRoute: {
    useParams: () => ({ id: '1' }),
    useNavigate: () => mockNavigate,
  },
}))

const definitions: ResourceDefinition[] = [
  {
    resource: 'roles',
    label: 'Roles',
    actions: ['view', 'create', 'edit', 'delete'],
    requires: {},
  },
  {
    resource: 'users',
    label: 'Users',
    actions: ['view', 'create'],
    requires: {},
  },
]

function renderRolesPermissions() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <Notifications />
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <RolesPermissions />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

function actionCheckbox(resourceLabel: string, action: string) {
  const card = screen
    .getByRole('checkbox', { name: resourceLabel })
    .closest<HTMLElement>('.mantine-Paper-root')!
  return within(card).getByRole('checkbox', { name: action })
}

// A requirement on another resource, like a required upload field
const withRequirements: ResourceDefinition[] = [
  {
    resource: 'roles',
    label: 'Roles',
    actions: ['view', 'create'],
    requires: {
      create: [
        { resource: 'roles', action: 'view' },
        { resource: 'uploads', action: 'create' },
      ],
    },
  },
  {
    resource: 'uploads',
    label: 'Uploads',
    actions: ['view', 'create'],
    requires: {},
  },
]

function serveRole(grants: Record<string, string[]>) {
  server.use(
    getRolesIdPermissionsHandler(createRolePermissionsResponse({ grants }))
  )
}

function serveOwnGrants(grants: Record<string, string[]>) {
  server.use(getMePermissionsHandler({ grants }))
}

beforeEach(() => {
  serveRole({ roles: ['view'] })
  server.use(getPermissionsResourcesHandler(definitions))
  // The signed-in user may grant the whole test catalog
  serveOwnGrants({
    roles: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create'],
    uploads: ['view', 'create'],
  })
})

afterEach(() => {
  vi.clearAllMocks()
  notifications.clean()
})

describe('RolesPermissions', () => {
  it('renders the page title', async () => {
    renderRolesPermissions()
    expect(
      await screen.findByRole('heading', { name: 'Edit permissions' })
    ).toBeInTheDocument()
  })

  it('renders the resource definitions with the saved grants checked', async () => {
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Roles' })
    expect(actionCheckbox('Roles', 'View')).toBeChecked()
    expect(actionCheckbox('Roles', 'Edit')).not.toBeChecked()
    expect(actionCheckbox('Users', 'View')).not.toBeChecked()
  })

  it('calls PUT /roles/:id/permissions with the edited grants', async () => {
    let capturedId: string | undefined
    let capturedBody: PutRolesIdPermissionsMutationRequest | undefined
    server.use(
      putRolesIdPermissionsHandler(async (info) => {
        capturedId = info.params.id as string
        capturedBody =
          (await info.request.json()) as PutRolesIdPermissionsMutationRequest
        return putRolesIdPermissionsHandlerResponse200(
          createRolePermissionsResponse({ grants: capturedBody.grants })
        )
      })
    )

    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Roles' })
    await userEvent.click(actionCheckbox('Roles', 'Edit'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Users' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(capturedBody).toBeDefined())
    expect(capturedId).toBe('1')
    expect(capturedBody).toEqual({
      grants: { roles: ['view', 'edit'], users: ['view', 'create'] },
    })
  })

  it('shows a success notification after saving', async () => {
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Roles' })
    await userEvent.click(actionCheckbox('Roles', 'Edit'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Permissions saved successfully')
    ).toBeInTheDocument()
  })

  it('shows a danger notification when saving fails', async () => {
    server.use(
      putRolesIdPermissionsHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Roles' })
    await userEvent.click(actionCheckbox('Roles', 'Edit'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Failed to save permissions')
    ).toBeInTheDocument()
  })

  it('navigates back to the role detail on cancel', async () => {
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Roles' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/roles/$id',
      params: { id: '1' },
    })
  })

  describe('unsaved changes', () => {
    it('disables Save until something changes and counts the changes', async () => {
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument()

      await userEvent.click(actionCheckbox('Roles', 'Edit'))
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

      await userEvent.click(actionCheckbox('Roles', 'View'))
      expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
    })

    it('undoes the changes', async () => {
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })
      const undo = screen.getByRole('button', { name: 'Undo changes' })
      expect(undo).toBeDisabled()

      await userEvent.click(actionCheckbox('Roles', 'Edit'))
      await userEvent.click(undo)
      expect(actionCheckbox('Roles', 'Edit')).not.toBeChecked()
      expect(actionCheckbox('Roles', 'View')).toBeChecked()
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })
  })

  describe('bulk actions', () => {
    it('checks every permission the user may grant', async () => {
      serveOwnGrants({ roles: ['view', 'create', 'edit', 'delete'] })
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })
      await userEvent.click(screen.getByRole('button', { name: 'Check all' }))

      for (const action of ['View', 'Create', 'Edit', 'Delete']) {
        expect(actionCheckbox('Roles', action)).toBeChecked()
      }
      expect(actionCheckbox('Users', 'View')).not.toBeChecked()
      // Nothing left the user may grant
      expect(screen.getByRole('button', { name: 'Check all' })).toBeDisabled()
    })

    it('clears every permission', async () => {
      serveRole({ roles: ['view', 'edit'], users: ['view'] })
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })
      await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))

      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).not.toBeChecked()
      }
      expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled()
    })
  })

  describe('requirements', () => {
    beforeEach(() => {
      server.use(getPermissionsResourcesHandler(withRequirements))
    })

    it('says what a click checked besides the clicked permission', async () => {
      serveRole({})
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })
      await userEvent.click(actionCheckbox('Roles', 'Create'))
      expect(
        await screen.findByText('Also checked: Roles › View, Uploads › Create')
      ).toBeInTheDocument()
    })

    it('says what a click unchecked besides the clicked permission', async () => {
      serveRole({ roles: ['view', 'create'], uploads: ['create'] })
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })
      await userEvent.click(actionCheckbox('Uploads', 'Create'))
      expect(
        await screen.findByText('Also unchecked: Roles › Create')
      ).toBeInTheDocument()
    })

    describe('saved without a requirement', () => {
      // Saved before roles:create needed uploads:create
      beforeEach(() => {
        serveRole({ roles: ['view', 'create'] })
      })

      it('highlights the missing permission and blocks saving', async () => {
        renderRolesPermissions()
        expect(
          await screen.findByText('1 required permission is unchecked')
        ).toBeInTheDocument()
        expect(
          screen.getByText('Check it: Roles › Create needs it')
        ).toBeInTheDocument()
        expect(actionCheckbox('Uploads', 'Create')).not.toBeChecked()
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
      })

      it('checks the missing permissions in one click', async () => {
        let capturedBody: PutRolesIdPermissionsMutationRequest | undefined
        server.use(
          putRolesIdPermissionsHandler(async (info) => {
            capturedBody =
              (await info.request.json()) as PutRolesIdPermissionsMutationRequest
            return putRolesIdPermissionsHandlerResponse200(
              createRolePermissionsResponse({ grants: capturedBody.grants })
            )
          })
        )
        renderRolesPermissions()
        await userEvent.click(
          await screen.findByRole('button', {
            name: 'Check required permissions',
          })
        )

        expect(actionCheckbox('Uploads', 'Create')).toBeChecked()
        expect(
          screen.queryByText('1 required permission is unchecked')
        ).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() =>
          expect(capturedBody).toEqual({
            grants: { roles: ['view', 'create'], uploads: ['create'] },
          })
        )
      })

      it('clears the alert when what needs the permission is unchecked', async () => {
        renderRolesPermissions()
        await screen.findByText('1 required permission is unchecked')
        await userEvent.click(actionCheckbox('Roles', 'Create'))
        expect(
          screen.queryByText('1 required permission is unchecked')
        ).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
      })

      it('asks to uncheck what needs a permission the user may not grant', async () => {
        serveOwnGrants({ roles: ['view', 'create'] })
        renderRolesPermissions()
        expect(
          await screen.findByText(/can't grant some of the highlighted/)
        ).toBeInTheDocument()
        expect(
          screen.queryByRole('button', { name: 'Check required permissions' })
        ).not.toBeInTheDocument()
        expect(actionCheckbox('Uploads', 'Create')).toBeDisabled()
        // Unchecking is always allowed
        expect(actionCheckbox('Roles', 'Create')).toBeEnabled()
      })
    })
  })

  describe('privilege ceiling', () => {
    it('disables what the user may not grant, and what requires it', async () => {
      server.use(getPermissionsResourcesHandler(withRequirements))
      serveRole({})
      serveOwnGrants({ roles: ['view', 'create'], uploads: ['view'] })
      renderRolesPermissions()
      await screen.findByRole('checkbox', { name: 'Roles' })

      expect(actionCheckbox('Uploads', 'Create')).toBeDisabled()
      // Checking it would check uploads:create too
      expect(actionCheckbox('Roles', 'Create')).toBeDisabled()
      expect(actionCheckbox('Roles', 'View')).toBeEnabled()
      expect(actionCheckbox('Uploads', 'View')).toBeEnabled()

      await userEvent.hover(actionCheckbox('Uploads', 'Create'))
      expect(
        await screen.findByText(
          "Your own role doesn't have this permission, so you can't grant it."
        )
      ).toBeInTheDocument()

      // The user holds roles:create: what blocks it is its requirement
      await userEvent.hover(actionCheckbox('Roles', 'Create'))
      expect(
        await screen.findByText(
          "Your own role can't grant Uploads › Create, which this permission requires."
        )
      ).toBeInTheDocument()
    })
  })
})
