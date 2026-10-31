import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlanCatalog } from './plan-catalog'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['todos', 'reports'] },
]

function renderCatalog(currentPlanId?: string) {
  render(
    <MantineProvider>
      <MantineEmotionProvider>
        <PlanCatalog plans={plans} currentPlanId={currentPlanId} />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('PlanCatalog', () => {
  it('renders every plan', () => {
    renderCatalog()
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('translates feature keys', () => {
    renderCatalog()
    expect(screen.getByText('Todos')).toBeInTheDocument()
  })

  it('falls back to the raw key for features without a translation', () => {
    renderCatalog()
    expect(screen.getByText('reports')).toBeInTheDocument()
  })

  it('describes a plan without features as basic access', () => {
    renderCatalog()
    expect(screen.getByText('Basic access')).toBeInTheDocument()
  })

  it('marks the current plan', () => {
    renderCatalog('pro')
    const current = screen
      .getByText('Current plan')
      .closest('[aria-current="true"]')
    expect(current).toHaveTextContent('Pro')
  })

  it('marks no plan when there is no current one', () => {
    renderCatalog()
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument()
  })
})
