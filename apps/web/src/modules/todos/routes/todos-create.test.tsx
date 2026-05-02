import {
  createTodo,
  postTodosHandler,
  postTodosHandlerResponse201,
} from '@helix/api-client/mocks'
import { MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { CreateTodoInput } from '../types'
import { TodoCreate } from './todos-create'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  todoCreateRoute: { useNavigate: () => mockNavigate },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('@helix/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@helix/ui')>()
  return {
    ...actual,
    RichTextEditor: ({
      label,
      value,
      onChange,
    }: {
      label?: string
      value?: string
      onChange?: (v: string) => void
    }) => (
      <textarea
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
  }
})

function renderTodoCreate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <TodoCreate />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(
    postTodosHandler(async (info) => {
      const body = (await info.request.json()) as CreateTodoInput
      return postTodosHandlerResponse201(
        createTodo({ ...(body as object), id: '99' })
      )
    })
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TodoCreate', () => {
  it('renders the create form', () => {
    renderTodoCreate()
    expect(
      screen.getByRole('heading', { name: 'Create Todo' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Pick a date')).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    renderTodoCreate()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const errors = await screen.findAllByText('Required')
    expect(errors.length).toBeGreaterThanOrEqual(2) // title + date
  })

  it('calls POST /todos with correct payload and navigates on success', async () => {
    let capturedBody: CreateTodoInput | undefined
    server.use(
      postTodosHandler(async (info) => {
        capturedBody = (await info.request.json()) as CreateTodoInput
        return postTodosHandlerResponse201(
          createTodo({ ...(capturedBody as object), id: '99' })
        )
      })
    )

    renderTodoCreate()
    await userEvent.type(screen.getByLabelText('Title'), 'My new todo')
    await userEvent.type(
      screen.getByLabelText('Description'),
      'Some description'
    )
    await userEvent.type(screen.getByLabelText('Content'), 'Some content')
    await userEvent.type(
      screen.getByPlaceholderText('Pick a date'),
      '01/01/2020'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        title: 'My new todo',
        description: 'Some description',
        content: 'Some content',
      })
      expect(capturedBody).not.toHaveProperty('status')
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/todos' })
    })
  })

  it('does not navigate when API returns error', async () => {
    server.use(
      postTodosHandler(
        () =>
          new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
          })
      )
    )

    renderTodoCreate()
    await userEvent.type(screen.getByLabelText('Title'), 'My new todo')
    await userEvent.type(
      screen.getByLabelText('Description'),
      'Some description'
    )
    await userEvent.type(screen.getByLabelText('Content'), 'Some content')
    await userEvent.type(
      screen.getByPlaceholderText('Pick a date'),
      '01/01/2020'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
