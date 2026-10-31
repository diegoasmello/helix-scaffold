import { createUserWithRole, getUsersAllHandler } from '@helix/api-client/mocks'
import { MantineProvider } from '@helix/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { UserSelectField } from './user-select-field'

const onChange = vi.fn()

const mockUsers = [
  createUserWithRole({
    id: 'user-1',
    name: 'Alice Silva',
    email: 'alice@example.com',
  }),
  createUserWithRole({
    id: 'user-2',
    name: 'Bob Santos',
    email: 'bob@example.com',
  }),
]

function renderField(props: { value?: string; required?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>
          <UserSelectField onChange={onChange} {...props} />
        </Suspense>
      </QueryClientProvider>
    </MantineProvider>
  )
}

beforeEach(() => {
  server.use(getUsersAllHandler(mockUsers))
})

afterEach(() => vi.clearAllMocks())

describe('UserSelectField', () => {
  it('renders the label and placeholder', async () => {
    renderField()
    expect(await screen.findByText('User')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search users')).toBeInTheDocument()
  })

  it('lists users from GET /users/all as "name (email)"', async () => {
    renderField()
    await userEvent.click(await screen.findByPlaceholderText('Search users'))
    expect(
      screen.getByRole('option', {
        name: 'Alice Silva (alice@example.com)',
        hidden: true,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', {
        name: 'Bob Santos (bob@example.com)',
        hidden: true,
      })
    ).toBeInTheDocument()
  })

  it('shows the selected user', async () => {
    renderField({ value: 'user-2' })
    expect(await screen.findByPlaceholderText('Search users')).toHaveValue(
      'Bob Santos (bob@example.com)'
    )
  })

  it('calls onChange with the user id when an option is picked', async () => {
    renderField()
    await userEvent.click(await screen.findByPlaceholderText('Search users'))
    await userEvent.click(
      screen.getByRole('option', {
        name: 'Alice Silva (alice@example.com)',
        hidden: true,
      })
    )
    expect(onChange).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ value: 'user-1' })
    )
  })

  it('filters options by search text', async () => {
    renderField()
    await userEvent.type(
      await screen.findByPlaceholderText('Search users'),
      'bob'
    )
    expect(
      screen.getByRole('option', {
        name: 'Bob Santos (bob@example.com)',
        hidden: true,
      })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', {
        name: 'Alice Silva (alice@example.com)',
        hidden: true,
      })
    ).not.toBeInTheDocument()
  })

  it('forwards Select props such as required', async () => {
    renderField({ required: true })
    expect(await screen.findByPlaceholderText('Search users')).toBeRequired()
  })
})
