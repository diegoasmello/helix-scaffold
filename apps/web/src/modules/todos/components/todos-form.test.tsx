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
    // RichTextEditor (Content) crashes its Grid.Col in jsdom because TipTapEditor
    // throws when the ProseMirror editor is null — covered by E2E instead.
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

  it('date is not required when status is pending', () => {
    renderForm('pending')
    expect(screen.getByPlaceholderText('Pick a date')).not.toBeRequired()
  })

  it('date is required when status is not pending', () => {
    renderForm('completed')
    expect(screen.getByPlaceholderText('Pick a date')).toBeRequired()
  })
})
