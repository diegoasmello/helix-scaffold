import { ApiError } from '@helix/api-client'
import { MantineEmotionProvider, MantineProvider } from '@helix/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from './error-boundary'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useRouter: () => ({ history: { back: vi.fn() } }),
    Navigate: (props: { to: string; replace?: boolean }) => (
      <div data-testid="navigate" data-replace={String(props.replace)}>
        {props.to}
      </div>
    ),
  }
})

function renderBoundary(error: Error) {
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <ErrorBoundary error={error} reset={vi.fn()} />
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('ErrorBoundary', () => {
  it('shows the error page for an unexpected error', () => {
    renderBoundary(new Error('Boom'))
    expect(screen.getByText('Boom')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument()
  })

  it('shows the error page for an API error other than 403', () => {
    renderBoundary(new ApiError('Internal Server Error', 500))
    expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
  })

  it('sends a refused permission to /403, replacing the entry', () => {
    renderBoundary(new ApiError('Forbidden', 403, 'permission_denied'))
    const navigate = screen.getByTestId('navigate')
    expect(navigate).toHaveTextContent('/403')
    expect(navigate).toHaveAttribute('data-replace', 'true')
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })

  it('sends a missing subscription to /upgrade', () => {
    renderBoundary(
      new ApiError('Subscription required', 403, 'subscription_required')
    )
    expect(screen.getByTestId('navigate')).toHaveTextContent('/upgrade')
  })
})
