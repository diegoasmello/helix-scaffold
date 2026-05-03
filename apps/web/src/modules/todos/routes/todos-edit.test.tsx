import {
  createTodo,
  getTodosIdHandler,
  patchTodosIdHandler,
  patchTodosIdHandlerResponse200,
} from '@helix/api-client/mocks'
import { MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { UpdateTodoInput } from '../types'
import { TodoEdit } from './todos-edit'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  todoEditRoute: {
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '1' }),
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

const mockTodo = createTodo({
  id: '1',
  title: 'Review quarterly report',
  description: 'Go through the Q1 report.',
  date: '2020-04-10',
  status: 'completed',
})

function renderTodoEdit() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <TodoEdit />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    getTodosIdHandler(mockTodo),
    patchTodosIdHandler(async (info) => {
      const body = (await info.request.json()) as UpdateTodoInput
      return patchTodosIdHandlerResponse200({ ...mockTodo, ...body })
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TodoEdit', () => {
  it('renders form pre-populated with item data', async () => {
    renderTodoEdit()
    expect(
      await screen.findByDisplayValue('Review quarterly report')
    ).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('Go through the Q1 report.')
    ).toBeInTheDocument()
  })

  it('shows validation errors when title is cleared and form is submitted', async () => {
    renderTodoEdit()
    await screen.findByDisplayValue('Review quarterly report')
    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Required')).toBeInTheDocument()
  })

  it('calls PATCH /todos/:id with updated payload and navigates on success', async () => {
    let capturedBody: UpdateTodoInput | undefined
    server.use(
      patchTodosIdHandler(async (info) => {
        capturedBody = (await info.request.json()) as UpdateTodoInput
        return patchTodosIdHandlerResponse200({ ...mockTodo, ...capturedBody })
      })
    )

    renderTodoEdit()
    await screen.findByDisplayValue('Review quarterly report')
    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.type(screen.getByLabelText('Title'), 'Updated title')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({ title: 'Updated title' })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/todos' })
    })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      patchTodosIdHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderTodoEdit()
    await screen.findByDisplayValue('Review quarterly report')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
