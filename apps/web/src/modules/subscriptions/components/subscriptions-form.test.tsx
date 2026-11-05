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

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports'] },
]

function FormWrapper(
  props: Readonly<{ isEditing?: boolean; planId?: string }>
) {
  const { isEditing, planId = '' } = props
  const form = useForm<SubscriptionFormValues>({
    initialValues: { ...base, planId },
  })
  return <SubscriptionsForm form={form} plans={plans} isEditing={isEditing} />
}

function renderForm(isEditing?: boolean, planId?: string) {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <FormWrapper isEditing={isEditing} planId={planId} />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('SubscriptionsForm', () => {
  it('renders all field labels', () => {
    renderForm()
    expect(screen.getByText('Plan')).toBeInTheDocument()
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

  it('marks plan as required', () => {
    renderForm()
    expect(screen.getByPlaceholderText('Select a plan')).toBeRequired()
  })

  it('shows the plan name for a plan in the catalog', () => {
    renderForm(true, 'pro')
    expect(screen.getByPlaceholderText('Select a plan')).toHaveValue('Pro')
  })

  it('keeps a plan removed from the catalog selectable', () => {
    renderForm(true, 'legacy')
    expect(screen.getByPlaceholderText('Select a plan')).toHaveValue('legacy')
  })
})
