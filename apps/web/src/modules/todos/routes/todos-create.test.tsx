import {
  createTodo,
  createUpload,
  postTodosHandler,
  postTodosHandlerResponse201,
} from '@helix/api-client/mocks'
import {
  MantineEmotionProvider,
  MantineProvider,
  type UseFormReturnType,
} from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import type { CreateTodoInput, TodoFormValues } from '../types'
import { TodoCreate } from './todos-create'

const mockNavigate = vi.fn()
const mockNotify = vi.hoisted(() => vi.fn())

vi.mock('@helix/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@helix/ui')>()),
  notify: mockNotify,
}))

vi.mock('.', () => ({
  todoCreateRoute: { useNavigate: () => mockNavigate },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

vi.mock('../components/todos-form', () => ({
  TodoForm: ({ form }: { form: UseFormReturnType<TodoFormValues> }) => (
    <div>
      <input
        aria-label="Title"
        placeholder="Todo title"
        value={form.values.title}
        onChange={(e) => form.setFieldValue('title', e.target.value)}
      />
      {form.errors.title && <span>{String(form.errors.title)}</span>}
      <textarea
        aria-label="Description"
        placeholder="Todo description"
        value={form.values.description}
        onChange={(e) => form.setFieldValue('description', e.target.value)}
      />
      {form.errors.description && (
        <span>{String(form.errors.description)}</span>
      )}
      <textarea
        aria-label="Content"
        placeholder="Todo content"
        value={form.values.content}
        onChange={(e) => form.setFieldValue('content', e.target.value)}
      />
      {form.errors.content && <span>{String(form.errors.content)}</span>}
      <input
        placeholder="Pick a date"
        value={form.values.date ?? ''}
        onChange={(e) => form.setFieldValue('date', e.target.value)}
      />
      {/* Upload field controls — use in tests to satisfy required validators */}
      <button
        type="button"
        data-testid="set-attachment"
        onClick={() =>
          form.setFieldValue('attachments', [createUpload({ id: 'att-1' })])
        }
      >
        Set Attachment
      </button>
      <button
        type="button"
        data-testid="set-file"
        onClick={() =>
          form.setFieldValue('file', createUpload({ id: 'file-1' }))
        }
      >
        Set File
      </button>
      <button
        type="button"
        data-testid="set-image"
        onClick={() =>
          form.setFieldValue('image', createUpload({ id: 'img-1' }))
        }
      >
        Set Image
      </button>
      {form.errors.attachments && (
        <span>{String(form.errors.attachments)}</span>
      )}
      {form.errors.file && <span>{String(form.errors.file)}</span>}
      {form.errors.image && <span>{String(form.errors.image)}</span>}
    </div>
  ),
}))

function renderTodoCreate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <TodoCreate />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
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
  it('renders the create form', async () => {
    renderTodoCreate()
    expect(
      await screen.findByRole('heading', { name: 'Create todo' })
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Todo title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Todo description')).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', async () => {
    renderTodoCreate()
    await screen.findByRole('heading', { name: 'Create todo' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const errors = await screen.findAllByText('Required')
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })

  it('sums up the fields to fix after an invalid submit', async () => {
    renderTodoCreate()
    await screen.findByRole('heading', { name: 'Create todo' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't save.")
    expect(alert).toHaveTextContent(/Fix the \d+ highlighted fields below\./)
  })

  it('flags unsaved changes next to the save button', async () => {
    renderTodoCreate()
    await screen.findByRole('heading', { name: 'Create todo' })
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Todo title'), 'New')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
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
    await screen.findByRole('heading', { name: 'Create todo' })

    // set required upload fields
    await userEvent.click(screen.getByTestId('set-attachment'))
    await userEvent.click(screen.getByTestId('set-file'))
    await userEvent.click(screen.getByTestId('set-image'))

    await userEvent.type(
      screen.getByPlaceholderText('Todo title'),
      'My new todo'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Todo description'),
      'Some description'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Todo content'),
      'Some content'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Pick a date'),
      '2020-01-01'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        title: 'My new todo',
        description: 'Some description',
        attachmentIds: ['att-1'],
        fileId: 'file-1',
        imageId: 'img-1',
        // A new todo is a draft unless its switch is turned on.
        published: false,
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
    await screen.findByRole('heading', { name: 'Create todo' })

    await userEvent.click(screen.getByTestId('set-attachment'))
    await userEvent.click(screen.getByTestId('set-file'))
    await userEvent.click(screen.getByTestId('set-image'))

    await userEvent.type(
      screen.getByPlaceholderText('Todo title'),
      'My new todo'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Todo description'),
      'Some description'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Todo content'),
      'Some content'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Pick a date'),
      '2020-01-01'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
  it('explains why the API refused a file', async () => {
    server.use(
      postTodosHandler(
        () =>
          new Response(
            JSON.stringify({
              message: 'Unknown upload, or one you did not upload',
              code: 'invalid_upload',
            }),
            { status: 400 }
          )
      )
    )

    renderTodoCreate()
    await screen.findByRole('heading', { name: 'Create todo' })
    await userEvent.click(screen.getByTestId('set-attachment'))
    await userEvent.click(screen.getByTestId('set-file'))
    await userEvent.click(screen.getByTestId('set-image'))
    await userEvent.type(screen.getByPlaceholderText('Todo title'), 'Todo')
    await userEvent.type(
      screen.getByPlaceholderText('Todo description'),
      'Description'
    )
    await userEvent.type(screen.getByPlaceholderText('Todo content'), 'Content')
    await userEvent.type(
      screen.getByPlaceholderText('Pick a date'),
      '2020-01-01'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith({
        status: 'danger',
        message:
          'One of the files was not uploaded by you or no longer exists. Remove it and upload it again.',
      })
    )
  })
})
