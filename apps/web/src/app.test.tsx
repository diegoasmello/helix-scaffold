import {
  createSubscription,
  getMePermissionsHandler,
  getMeSubscriptionHandler,
  getMeSubscriptionHandlerResponse200,
  getMeSubscriptionHandlerResponse204,
  getSubscriptionStatusHandler,
  getSubscriptionStatusHandlerResponse200,
} from '@helix/api-client/mocks'
import type { Grants } from '@helix/api-client/types'
import { type LayoutProps, MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './app'
import { server } from './mocks/server'

const { mockNavigate, mockSignOut } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('./lib/authentication', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          image: null,
          roleId: 'test-role',
        },
      },
      isPending: false,
    }),
    signOut: mockSignOut,
  },
}))

// The real Layout renders <Outlet /> and needs a router. Render just the
// props App computes: the sidebar groups and the header callbacks.
vi.mock('@helix/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@helix/ui')>()
  return {
    ...actual,
    Layout: (props: LayoutProps) => (
      <div>
        <span data-testid="user-name">{props.user.name}</span>
        {props.sidebarGroups.map((group, index) => (
          <section key={group.title ?? index} data-testid="sidebar-group">
            {group.title && <h2>{group.title}</h2>}
            {group.items.map((item) => (
              <a key={item.label} href={item.to}>
                {item.label}
              </a>
            ))}
          </section>
        ))}
        <button type="button" onClick={props.onAccountSettings}>
          Account settings
        </button>
        <button type="button" onClick={props.onLogout}>
          Log out
        </button>
      </div>
    ),
  }
})

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['todos'] },
]

const ALL_GRANTS: Grants = {
  todos: ['view'],
  users: ['view'],
  roles: ['view'],
  audit: ['view'],
}

function mockPermissions(grants: Grants) {
  server.use(getMePermissionsHandler({ grants }))
}

function mockSubscriptionsEnabled(planId: string | null) {
  server.use(
    getSubscriptionStatusHandler(() =>
      getSubscriptionStatusHandlerResponse200({ enabled: true, plans })
    ),
    getMeSubscriptionHandler(() =>
      planId
        ? getMeSubscriptionHandlerResponse200(
            createSubscription({ planId, status: 'active' })
          )
        : getMeSubscriptionHandlerResponse204()
    )
  )
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  )
}

function sidebarLinks() {
  return screen.queryAllByRole('link').map((link) => link.textContent)
}

beforeEach(() => {
  // Default handlers: subscriptions disabled.
  mockPermissions(ALL_GRANTS)
})

afterEach(() => vi.clearAllMocks())

describe('App', () => {
  it('shows a loader while permissions are loading', () => {
    server.use(
      getMePermissionsHandler(async () => {
        await delay('infinite')
        return new Response(null)
      })
    )
    const { container } = renderApp()
    expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument()
    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument()
  })

  it('passes the current user to the layout', async () => {
    renderApp()
    expect(await screen.findByTestId('user-name')).toHaveTextContent(
      'Test User'
    )
  })

  it('shows the sidebar items the user has permission for', async () => {
    renderApp()
    await screen.findByTestId('user-name')
    expect(sidebarLinks()).toEqual(['Todos', 'Users', 'Roles', 'Audit Log'])
    expect(
      screen.getByRole('heading', { name: 'Settings' })
    ).toBeInTheDocument()
  })

  it('hides sidebar items the user lacks permission for', async () => {
    mockPermissions({ todos: ['view'], users: ['view'] })
    renderApp()
    await screen.findByTestId('user-name')
    expect(sidebarLinks()).toEqual(['Todos', 'Users'])
  })

  it('drops groups that end up with no visible items', async () => {
    mockPermissions({ todos: ['view'] })
    renderApp()
    await screen.findByTestId('user-name')
    expect(screen.getAllByTestId('sidebar-group')).toHaveLength(1)
    expect(
      screen.queryByRole('heading', { name: 'Settings' })
    ).not.toBeInTheDocument()
  })

  describe('with subscriptions disabled', () => {
    it('hides the Subscriptions item even with permission', async () => {
      mockPermissions({ ...ALL_GRANTS, subscriptions: ['view'] })
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).not.toContain('Subscriptions')
    })

    it('shows feature-gated items without a subscription', async () => {
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).toContain('Todos')
    })
  })

  describe('with subscriptions enabled', () => {
    it('shows the Subscriptions item to users with permission', async () => {
      mockSubscriptionsEnabled(null)
      mockPermissions({ ...ALL_GRANTS, subscriptions: ['view'] })
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).toContain('Subscriptions')
    })

    it('hides feature-gated items from users without a subscription', async () => {
      mockSubscriptionsEnabled(null)
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).toEqual(['Users', 'Roles', 'Audit Log'])
    })

    it('hides feature-gated items when the plan lacks the feature', async () => {
      mockSubscriptionsEnabled('starter')
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).not.toContain('Todos')
    })

    it('shows feature-gated items when the plan includes the feature', async () => {
      mockSubscriptionsEnabled('pro')
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).toContain('Todos')
    })

    it('shows feature-gated items to operators without a subscription', async () => {
      mockSubscriptionsEnabled(null)
      mockPermissions({ ...ALL_GRANTS, subscriptions: ['view'] })
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).toContain('Todos')
    })

    it('still requires the permission for feature-gated items', async () => {
      mockSubscriptionsEnabled('pro')
      mockPermissions({ users: ['view'] })
      renderApp()
      await screen.findByTestId('user-name')
      expect(sidebarLinks()).toEqual(['Users'])
    })
  })

  it('navigates to /me from account settings', async () => {
    renderApp()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Account settings' })
    )
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/me' })
  })

  it('signs out on logout', async () => {
    renderApp()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Log out' })
    )
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled())
  })
})
