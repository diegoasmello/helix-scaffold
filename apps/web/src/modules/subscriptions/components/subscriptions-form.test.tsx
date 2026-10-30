import { MantineEmotionProvider, MantineProvider, useForm } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SubscriptionFormValues } from '../types'
import { SubscriptionsForm } from './subscriptions-form'

vi.mock('../../users/components/user-select-field', () => ({
  UserSelectField: () => <div data-testid="user-select-field" />,
}))

const base: SubscriptionFormValues = {
  userId: '',
  planId: '',
  status: 'active',
  currentPeriodStart: '2026-01-01',
  currentPeriodEnd: '2026-02-01',
  trialEndsAt: null,
  externalId: '',
}

function FormWrapper(props: Readonly<{ isEditing?: boolean }>) {
  const { isEditing } = props
  const form = useForm<SubscriptionFormValues>({ initialValues: base })
  return <SubscriptionsForm form={form} isEditing={isEditing} />
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

describe('SubscriptionsForm', () => {
  it('renders all field labels', () => {
    renderForm()
    expect(screen.getByText('Plan ID')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Period start')).toBeInTheDocument()
    expect(screen.getByText('Period end')).toBeInTheDocument()
  })

  it('renders the user select field when not editing', () => {
    renderForm()
    expect(screen.getByTestId('user-select-field')).toBeInTheDocument()
  })

  it('hides the user select field when editing', () => {
    renderForm(true)
    expect(screen.queryByTestId('user-select-field')).not.toBeInTheDocument()
  })

  it('marks plan ID as required', () => {
    renderForm()
    expect(
      screen.getByPlaceholderText('e.g. pro, starter, enterprise')
    ).toBeRequired()
  })
})
