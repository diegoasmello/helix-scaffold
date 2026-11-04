import { MantineEmotionProvider, MantineProvider, useForm } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TodoFormValues, TodoStatus } from '../types'
import { TodoForm } from './todos-form'

const base: TodoFormValues = {
  title: '',
  description: '',
  content: '',
  date: null,
  status: 'pending',
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
