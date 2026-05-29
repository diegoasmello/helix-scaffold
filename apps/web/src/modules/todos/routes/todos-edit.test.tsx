import {
  createTodo,
  createUpload,
  getTodosIdHandler,
  patchTodosIdHandler,
  patchTodosIdHandlerResponse200,
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
import type { TodoFormValues, UpdateTodoInput } from '../types'
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

vi.mock('../components/todos-form', () => ({
  TodoForm: ({ form }: { form: UseFormReturnType<TodoFormValues> }) => (
    <div>
      <input
        aria-label="Title"
        placeholder="Todo title"
        value={form.values.title ?? ''}
        onChange={(e) => form.setFieldValue('title', e.target.value)}
      />
      {form.errors.title && <span>{String(form.errors.title)}</span>}
      <textarea
        aria-label="Description"
        placeholder="Todo description"
        value={form.values.description}
        onChange={(e) => form.setFieldValue('description', e.target.value)}
      />
      <textarea
        aria-label="Content"
        placeholder="Todo content"
        value={form.values.content}
        onChange={(e) => form.setFieldValue('content', e.target.value)}
      />
      <input
        placeholder="Pick a date"
        value={form.values.date ?? ''}
        onChange={(e) => form.setFieldValue('date', e.target.value)}
      />
      {form.values.attachments.map((a) => (
        <span key={a.originalName}>{a.originalName}</span>
      ))}
    </div>
  ),
}))

const mockAttachment = createUpload({
  id: 'attach-1',
  originalName: 'report.pdf',
  mimeType: 'application/pdf',
  variants: null,
})
const mockFile = createUpload({
  id: 'file-1',
  originalName: 'document.pdf',
  mimeType: 'application/pdf',
  variants: null,
})
const mockImage = createUpload({
  id: 'img-1',
  originalName: 'photo.jpg',
  mimeType: 'image/jpeg',
  variants: null,
})

const mockTodo = createTodo({
  id: '1',
  title: 'Review quarterly report',
  description: 'Go through the Q1 report.',
  date: '2020-04-10',
  status: 'completed',
  attachments: [mockAttachment],
  file: mockFile,
  image: mockImage,
})

function renderTodoEdit() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading...</div>}>
            <TodoEdit />
          </Suspense>
        </QueryClientProvider>
      </MantineEmotionProvider>
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
    await userEvent.clear(screen.getByPlaceholderText('Todo title'))
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
    await userEvent.clear(screen.getByPlaceholderText('Todo title'))
    await userEvent.type(
      screen.getByPlaceholderText('Todo title'),
      'Updated title'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        title: 'Updated title',
        attachmentIds: ['attach-1'],
        fileId: 'file-1',
        imageId: 'img-1',
      })
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/todos' })
    })
  })

  it('pre-populates attachment field with existing attachments', async () => {
    renderTodoEdit()
    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
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
