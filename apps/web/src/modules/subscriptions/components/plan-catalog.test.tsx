import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import { PlanCatalog } from './plan-catalog'

const plans = [
  { id: 'starter', name: 'Starter', features: [] },
  { id: 'pro', name: 'Pro', features: ['reports', 'exports'] },
]

// A product labels its features in `subscription.json` → `features.<key>`;
// the test labels one of its own, so it does not depend on which exist.
beforeAll(() => {
  i18n.addResource('en', 'subscription', 'features.reports', 'Reports')
})

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
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('falls back to the raw key for features without a translation', () => {
    renderCatalog()
    expect(screen.getByText('exports')).toBeInTheDocument()
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
