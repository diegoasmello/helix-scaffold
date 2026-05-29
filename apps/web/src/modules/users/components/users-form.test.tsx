import { MantineEmotionProvider, MantineProvider, useForm } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { UserFormValues } from '../types'
import { UsersForm } from './users-form'

vi.mock('../../roles/components/role-select-field', () => ({
  RoleSelectField: () => <div />,
}))

const base: UserFormValues = {
  name: '',
  email: '',
  roleId: null,
  password: '',
}

function FormWrapper({ isEditing }: { isEditing?: boolean }) {
  const form = useForm<UserFormValues>({ initialValues: base })
  return <UsersForm form={form} isEditing={isEditing} />
}

function renderForm(isEditing?: boolean) {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <FormWrapper isEditing={isEditing} />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('UsersForm', () => {
  it('renders all field labels', () => {
    renderForm()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
  })

  it('hides password field when editing', () => {
    renderForm(true)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.queryByText('Password')).not.toBeInTheDocument()
  })

  it('marks name and email as required', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Full name')).toBeRequired()
    expect(screen.getByPlaceholderText('email@example.com')).toBeRequired()
  })

  it('password is required when not editing', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeRequired()
  })
})
