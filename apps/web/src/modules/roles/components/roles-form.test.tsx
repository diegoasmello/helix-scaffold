import { MantineEmotionProvider, MantineProvider, useForm } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { registrationStatusQueryOptions } from '@/modules/auth/use-registration-open'

import type { RoleFormValues } from '../types'
import { RolesForm } from './roles-form'

const base: RoleFormValues = {
  name: '',
  description: '',
  isDefault: false,
}

function FormWrapper() {
  const form = useForm<RoleFormValues>({ initialValues: base })
  return <RolesForm form={form} />
}

function renderForm(registrationOpen = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  // Seeded like the route loaders do, so the first render already knows
  queryClient.setQueryData(registrationStatusQueryOptions().queryKey, {
    open: registrationOpen,
    providers: [],
  })
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <QueryClientProvider client={queryClient}>
          <FormWrapper />
        </QueryClientProvider>
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

  it('shows the default role switch when registration is open', () => {
    renderForm(true)
    expect(
      screen.getByText('Default role for self-registration')
    ).toBeInTheDocument()
  })

  it('hides the default role switch when registration is closed', () => {
    renderForm(false)
    expect(
      screen.queryByText('Default role for self-registration')
    ).not.toBeInTheDocument()
  })
})
