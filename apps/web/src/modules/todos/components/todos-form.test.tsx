import { createUpload } from '@helix/api-client/mocks'
import {
  Form,
  MantineEmotionProvider,
  MantineProvider,
  useForm,
} from '@helix/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { TodoFormValues, TodoStatus } from '../types'
import { todoFormValidate } from '../validation'
import { TodoForm } from './todos-form'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useBlocker: vi.fn() }
})

const base: TodoFormValues = {
  title: '',
  description: '',
  content: '',
  date: null,
  status: 'pending',
  published: false,
  attachments: [],
  file: null,
  image: null,
}

function FormWrapper({ status = 'pending' }: { status?: TodoStatus }) {
  const form = useForm<TodoFormValues>({ initialValues: { ...base, status } })
  return <TodoForm form={form} />
}

function renderForm(status?: TodoStatus) {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <FormWrapper status={status} />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('TodoForm', () => {
  it('renders all field labels', () => {
    renderForm()
    expect(screen.getByText('Image')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    // RichTextEditor is the <textarea> of __mocks__/@helix/ui.tsx in tests.
    expect(screen.getByLabelText('Content')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Attachments')).toBeInTheDocument()
    expect(screen.getByText('File (PDF)')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /^Published/ })).not.toBeChecked()
  })

  it('turns publication on with its switch', async () => {
    renderForm()
    const toggle = screen.getByRole('switch', { name: /^Published/ })
    await userEvent.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('marks title and description as required', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Todo title')).toBeRequired()
    expect(screen.getByPlaceholderText('Todo description')).toBeRequired()
  })

  it('marks image, attachments, and file as required', () => {
    renderForm()
    // FileInput and FilesInput are custom components — toBeRequired() does not work.
    // Mantine sets data-required="true" on the label element when required is true.
    expect(screen.getByText('Image').closest('label')).toHaveAttribute(
      'data-required',
      'true'
    )
    expect(screen.getByText('Attachments').closest('label')).toHaveAttribute(
      'data-required',
      'true'
    )
    expect(screen.getByText('File (PDF)').closest('label')).toHaveAttribute(
      'data-required',
      'true'
    )
  })

  it.each(['pending', 'completed'] as const)(
    'date is required, whatever the status (%s)',
    (status) => {
      renderForm(status)
      expect(screen.getByPlaceholderText('Pick a date')).toBeRequired()
    }
  )
})

describe('TodoForm — focus after an invalid submit', () => {
  function ValidatedForm(
    props: Readonly<{ initial: Partial<TodoFormValues> }>
  ) {
    const { initial } = props
    const form = useForm<TodoFormValues>({
      initialValues: { ...base, ...initial },
      validate: todoFormValidate,
    })

    return (
      <Form form={form} onSubmit={() => {}}>
        <TodoForm form={form} />
        <button type="submit">Save</button>
      </Form>
    )
  }

  async function submit(initial: Partial<TodoFormValues>) {
    render(
      <MantineProvider>
        <MantineEmotionProvider>
          <ValidatedForm initial={initial} />
        </MantineEmotionProvider>
      </MantineProvider>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  }

  it('focuses the date before the content above it on screen', async () => {
    // The rules list `content` before `date`; the date is drawn first.
    await submit({ title: 'Buy milk', description: 'Today' })
    expect(screen.getByPlaceholderText('Pick a date')).toHaveFocus()
  })

  it('focuses the drop area of an empty file field', async () => {
    await submit({
      title: 'Buy milk',
      description: 'Today',
      content: '<p>Two litres</p>',
      date: '2026-11-05',
    })
    // Image is the first file field on screen, though its rule comes last.
    const image = screen.getByRole('group', { name: 'Image' })
    expect(image.querySelector('[data-path="image"]')).toHaveFocus()
  })

  it('focuses the drop area of an empty multi-file field', async () => {
    await submit({
      title: 'Buy milk',
      description: 'Today',
      content: '<p>Two litres</p>',
      date: '2026-11-05',
      image: createUpload({ id: 'img-1' }),
    })
    const attachments = screen.getByRole('group', { name: 'Attachments' })
    expect(attachments.querySelector('[data-path="attachments"]')).toHaveFocus()
  })
})
