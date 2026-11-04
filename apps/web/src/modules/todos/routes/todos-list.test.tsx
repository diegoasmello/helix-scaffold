import {
  createPaginatedTodos,
  createTodo,
  deleteTodosIdHandler,
  deleteTodosIdHandlerResponse204,
  getMePermissionsHandler,
  getTodosHandler,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  ModalsProvider,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { TodoList } from './todos-list'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockSearch = vi.hoisted(() => ({
  state: {
    page: 1,
    pageSize: 10,
    sortOrder: 'desc' as const,
    filterLogic: 'AND' as const,
    filters: undefined as string | undefined,
    search: undefined as string | undefined,
  },
}))

vi.mock('.', () => ({
  todoListRoute: {
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearch.state,
  },
}))

vi.mock('../../../lib/authentication', () => ({
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
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

const mockTodos = [
  createTodo({
    id: '1',
    title: 'Review quarterly report',
    status: 'completed',
  }),
  createTodo({
    id: '2',
    title: 'Update project documentation',
    status: 'pending',
  }),
]

function renderTodoList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<div>Loading...</div>}>
              <TodoList />
            </Suspense>
          </QueryClientProvider>
        </ModalsProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  mockSearch.state = {
    page: 1,
    pageSize: 10,
    sortOrder: 'desc',
    filterLogic: 'AND',
    filters: undefined,
    search: undefined,
  }
  mockNavigate.mockReset()
  server.use(
    getTodosHandler(
      createPaginatedTodos({
        data: mockTodos,
        total: mockTodos.length,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      })
    ),
    getMePermissionsHandler({
      grants: { todos: ['view', 'create', 'edit', 'delete'] },
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TodoList', () => {
  it('hides Create and Delete without the permissions', async () => {
    server.use(getMePermissionsHandler({ grants: { todos: ['view', 'edit'] } }))
    renderTodoList()
    // The positive control: Edit shows up only once the grants have arrived
    await screen.findAllByRole('button', { name: 'Edit' })
    expect(
      screen.queryByRole('button', { name: 'Delete' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create' })
    ).not.toBeInTheDocument()
  })

  it('hides Edit without the permission', async () => {
    server.use(
      getMePermissionsHandler({ grants: { todos: ['view', 'delete'] } })
    )
    renderTodoList()
    // The positive control: Delete shows up only once the grants have arrived
    await screen.findAllByRole('button', { name: 'Delete' })
    expect(
      screen.queryByRole('button', { name: 'Edit' })
    ).not.toBeInTheDocument()
  })

  it('renders all todo items', async () => {
    renderTodoList()
    expect(
      await screen.findByText('Review quarterly report')
    ).toBeInTheDocument()
    expect(screen.getByText('Update project documentation')).toBeInTheDocument()
  })

  it('shows completed badge for completed todos', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    const rows = screen.getAllByRole('row')
    const completedRow = rows.find((r) =>
      within(r).queryByText('Review quarterly report')
    )!
    expect(within(completedRow).getByText('Completed')).toBeInTheDocument()
  })

  it('shows pending badge for pending todos', async () => {
    renderTodoList()
    await screen.findByText('Update project documentation')
    const rows = screen.getAllByRole('row')
    const pendingRow = rows.find((r) =>
      within(r).queryByText('Update project documentation')
    )!
    expect(within(pendingRow).getByText('Pending')).toBeInTheDocument()
  })

  it('shows the result count and the pagination summary', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    expect(screen.getByText('2 results')).toBeInTheDocument()
    const pagination = screen.getByRole('navigation', { name: 'Pagination' })
    expect(pagination).toHaveTextContent('Showing 1–2 of 2')
    expect(pagination).toHaveTextContent('Page 1 of 1')
    expect(
      within(pagination).getByRole('button', { name: 'Next' })
    ).toBeDisabled()
  })

  it('opens delete modal when delete button is clicked', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Delete' }))[0]
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete todo')).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Are you sure you want to delete this todo? This action cannot be undone.'
      )
    ).toBeInTheDocument()
  })

  it('calls delete endpoint and closes modal on confirm', async () => {
    let deletedId: string | undefined
    server.use(
      deleteTodosIdHandler((info) => {
        deletedId = info.params.id as string
        return deleteTodosIdHandlerResponse204()
      })
    )

    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Delete' }))[0]
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(deletedId).toBe('1'))
  })

  it('closes delete modal on cancel', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Delete' }))[0]
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
  })
})

describe('Filters', () => {
  const lastSearch = () => {
    const [{ search }] = mockNavigate.mock.calls.at(-1) as [
      { search: (prev: typeof mockSearch.state) => Record<string, unknown> },
    ]
    return search({ ...mockSearch.state, page: 3 })
  }

  const withFilters = (conditions: unknown[]) => {
    mockSearch.state = {
      ...mockSearch.state,
      filters: JSON.stringify(conditions),
    }
  }

  it('shows the Filters button without a count or chips when none apply', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  it('shows each applied condition as a chip, in words', async () => {
    withFilters([
      { field: 'status', op: 'eq', value: 'pending' },
      { field: 'date', op: 'between', value: ['2026-10-01', '2026-10-31'] },
    ])
    renderTodoList()
    await screen.findByText('Review quarterly report')
    expect(
      screen.getByRole('button', { name: 'Filters, 2 applied' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove filter: Status is Pending' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Remove filter: Date is between 10/1/2026 and 10/31/2026',
      })
    ).toBeInTheDocument()
  })

  it('ignores a malformed filters param', async () => {
    mockSearch.state = { ...mockSearch.state, filters: 'abc' }
    renderTodoList()
    await screen.findByText('Review quarterly report')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
  })

  it('removes one condition from its chip, back to page 1', async () => {
    withFilters([
      { field: 'status', op: 'eq', value: 'pending' },
      { field: 'title', op: 'contains', value: 'report' },
    ])
    renderTodoList()
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Remove filter: Status is Pending',
      })
    )
    const search = lastSearch()
    expect(JSON.parse(search.filters as string)).toEqual([
      { field: 'title', op: 'contains', value: 'report' },
    ])
    expect(search.page).toBe(1)
  })

  it('clears every condition', async () => {
    withFilters([{ field: 'status', op: 'eq', value: 'pending' }])
    renderTodoList()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Clear all' })
    )
    expect(lastSearch().filters).toBeUndefined()
  })

  it('adds a condition starting from the field and applies it', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add condition' })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Title' })
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Value of condition 1' }),
      'report'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    const search = lastSearch()
    expect(JSON.parse(search.filters as string)).toEqual([
      { field: 'title', op: 'contains', value: 'report' },
    ])
    expect(search.filterLogic).toBe('AND')
    expect(search.page).toBe(1)
  })

  it('flags an incomplete condition instead of applying it', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Add condition' })
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Title' })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(
      await screen.findByText('Fill in a value or remove this condition.')
    ).toBeInTheDocument()
    expect(screen.getByText('1 condition · 1 incomplete')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('edits the applied conditions and switches to any condition', async () => {
    withFilters([{ field: 'status', op: 'eq', value: 'pending' }])
    renderTodoList()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Filters, 1 applied' })
    )
    await userEvent.click(await screen.findByText('any condition'))
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove condition: Status' })
    )
    expect(screen.getByText('No conditions')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    const search = lastSearch()
    expect(search.filters).toBeUndefined()
    expect(search.filterLogic).toBe('OR')
  })

  it('searches as the user types, back to page 1', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search by title or description' }),
      'report'
    )
    await waitFor(() => expect(lastSearch().search).toBe('report'))
    expect(lastSearch().page).toBe(1)
  })

  describe('when nothing matches', () => {
    beforeEach(() => {
      mockSearch.state = {
        ...mockSearch.state,
        search: 'zzz',
        filters: JSON.stringify([
          { field: 'status', op: 'eq', value: 'pending' },
        ]),
      } as typeof mockSearch.state
      server.use(
        getTodosHandler(
          createPaginatedTodos({
            data: [],
            total: 0,
            page: 1,
            pageSize: 10,
            totalPages: 0,
          })
        )
      )
    })

    it('says why and offers to clear the search and filters', async () => {
      renderTodoList()
      expect(await screen.findByText('No todos found')).toBeInTheDocument()
      expect(
        screen.getByText(/No todo matches the search “zzz”/)
      ).toBeInTheDocument()
      await userEvent.click(
        screen.getByRole('button', { name: 'Clear search and filters' })
      )
      const search = lastSearch()
      expect(search.filters).toBeUndefined()
      expect(search.search).toBeUndefined()
    })

    it('opens the filter panel from Edit filters', async () => {
      renderTodoList()
      await userEvent.click(
        await screen.findByRole('button', { name: 'Edit filters' })
      )
      expect(
        await screen.findByRole('button', { name: 'Apply filters' })
      ).toBeInTheDocument()
    })
  })

  it('closes the panel on Cancel without changing the URL', async () => {
    renderTodoList()
    await screen.findByText('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Apply filters' })
      ).not.toBeInTheDocument()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('TodoList layout', () => {
  describe('on small screens', () => {
    const originalMatchMedia = window.matchMedia

    beforeEach(() => {
      // Below the `sm` breakpoint: every `min-width` query fails.
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        ...originalMatchMedia(query),
        matches: !query.includes('min-width'),
      }))
    })

    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })

    it('renders one card per todo instead of a table', async () => {
      renderTodoList()
      await screen.findByText('Review quarterly report')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      const cards = screen.getAllByRole('listitem')
      expect(cards).toHaveLength(2)
      const first = within(cards[0])
      expect(first.getByText('Review quarterly report')).toBeInTheDocument()
      expect(first.getByText('Date')).toBeInTheDocument()
      expect(first.queryByText('Status')).not.toBeInTheDocument()
      expect(first.getByText('Completed')).toBeInTheDocument()
      expect(first.getByRole('button', { name: 'View' })).toBeInTheDocument()
      expect(
        await first.findByRole('button', { name: 'Edit' })
      ).toBeInTheDocument()
    })

    it('deletes from a card', async () => {
      renderTodoList()
      await screen.findByText('Review quarterly report')
      const [first] = screen.getAllByRole('listitem')
      await userEvent.click(
        await within(first).findByRole('button', { name: 'Delete' })
      )
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Delete todo')).toBeInTheDocument()
    })

    it('opens the filters full screen', async () => {
      mockSearch.state = {
        ...mockSearch.state,
        filters: JSON.stringify([
          { field: 'status', op: 'in', value: ['pending', 'completed'] },
        ]),
      }
      renderTodoList()
      expect(
        await screen.findByRole('button', {
          name: 'Remove filter: Status is any of Pending, Completed',
        })
      ).toBeInTheDocument()
      await userEvent.click(
        screen.getByRole('button', { name: 'Filters, 1 applied' })
      )
      const dialog = await screen.findByRole('dialog', { name: 'Filters' })
      expect(within(dialog).getByText('Condition 1')).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: 'Remove condition' })
      ).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: 'Clear all' })
      ).toBeInTheDocument()
    })

    it('pages with previous/next buttons', async () => {
      server.use(
        getTodosHandler(
          createPaginatedTodos({
            data: mockTodos,
            total: 25,
            page: 1,
            pageSize: 10,
            totalPages: 3,
          })
        )
      )
      renderTodoList()
      expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
      const [{ search }] = mockNavigate.mock.calls.at(-1) as [
        { search: (prev: typeof mockSearch.state) => typeof mockSearch.state },
      ]
      expect(search(mockSearch.state).page).toBe(2)
    })
  })
})
