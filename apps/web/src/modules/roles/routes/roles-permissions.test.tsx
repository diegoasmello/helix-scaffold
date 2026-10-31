import {
  createRolePermissionsResponse,
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
    resource: 'todos',
    label: 'Todos',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  { resource: 'users', label: 'Users', actions: ['view', 'create'] },
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

beforeEach(() => {
  server.use(
    getRolesIdPermissionsHandler(
      createRolePermissionsResponse({ grants: { todos: ['view'] } })
    ),
    getPermissionsResourcesHandler(definitions)
  )
})

afterEach(() => {
  vi.clearAllMocks()
  notifications.clean()
})

describe('RolesPermissions', () => {
  it('renders the page title', async () => {
    renderRolesPermissions()
    expect(
      await screen.findByRole('heading', { name: 'Edit Permissions' })
    ).toBeInTheDocument()
  })

  it('renders the resource definitions with the saved grants checked', async () => {
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Todos' })
    expect(actionCheckbox('Todos', 'View')).toBeChecked()
    expect(actionCheckbox('Todos', 'Edit')).not.toBeChecked()
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
    await screen.findByRole('checkbox', { name: 'Todos' })
    await userEvent.click(actionCheckbox('Todos', 'Edit'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Users' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(capturedBody).toBeDefined())
    expect(capturedId).toBe('1')
    expect(capturedBody).toEqual({
      grants: { todos: ['view', 'edit'], users: ['view', 'create'] },
    })
  })

  it('shows a success notification after saving', async () => {
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Todos' })
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
    await screen.findByRole('checkbox', { name: 'Todos' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Failed to save permissions')
    ).toBeInTheDocument()
  })

  it('navigates back to the role detail on cancel', async () => {
    renderRolesPermissions()
    await screen.findByRole('checkbox', { name: 'Todos' })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/roles/$id',
      params: { id: '1' },
    })
  })
})
