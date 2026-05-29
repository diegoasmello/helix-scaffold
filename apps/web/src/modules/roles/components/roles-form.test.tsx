import { MantineEmotionProvider, MantineProvider, useForm } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { RoleFormValues } from '../types'
import { RolesForm } from './roles-form'

const base: RoleFormValues = {
  name: '',
  description: '',
}

function FormWrapper() {
  const form = useForm<RoleFormValues>({ initialValues: base })
  return <RolesForm form={form} />
}

function renderForm() {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <FormWrapper />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('RolesForm', () => {
  it('renders all field labels', () => {
    renderForm()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('marks required fields', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Role name')).toBeRequired()
    expect(screen.getByPlaceholderText('Role description')).toBeRequired()
  })
})
