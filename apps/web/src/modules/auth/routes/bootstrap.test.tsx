import {
  postBootstrapHandler,
  postBootstrapHandlerResponse201,
  postBootstrapHandlerResponse409,
} from '@helix/api-client/mocks'
import type { PostBootstrapMutationRequest } from '@helix/api-client/types'
import { MantineProvider } from '@helix/ui'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '../../../mocks/server'
import { Bootstrap } from './bootstrap'

const mockNavigate = vi.fn()

vi.mock('.', () => ({
  bootstrapRoute: { useNavigate: () => mockNavigate },
}))

function renderBootstrap() {
  return render(
    <MantineProvider>
      <Bootstrap />
    </MantineProvider>
  )
}

async function fillForm(password = 'password123') {
  await userEvent.type(screen.getByPlaceholderText('Admin name'), 'Admin')
  await userEvent.type(
    screen.getByPlaceholderText('admin@example.com'),
    'admin@example.com'
  )
  await userEvent.type(
    screen.getByPlaceholderText('Min 8 characters'),
    password
  )
}

function submit() {
  return userEvent.click(
    screen.getByRole('button', { name: 'Create admin account' })
  )
}

afterEach(() => vi.clearAllMocks())

describe('Bootstrap', () => {
  it('renders the setup form', () => {
    renderBootstrap()
    expect(
      screen.getByRole('heading', { name: 'System setup' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This account will have full access to all system resources.'
      )
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Admin name')).toBeRequired()
    expect(screen.getByPlaceholderText('admin@example.com')).toBeRequired()
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeRequired()
  })

  it('shows validation errors when submitting an empty form', async () => {
    const { container } = renderBootstrap()
    // Native `required` blocks a button-click submit in jsdom; submit directly
    // so the Mantine validators run.
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findAllByText('Required')).toHaveLength(2)
    expect(screen.getByText('Min 8 characters')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only name as empty', async () => {
    renderBootstrap()
    await userEvent.type(screen.getByPlaceholderText('Admin name'), '   ')
    await userEvent.type(
      screen.getByPlaceholderText('admin@example.com'),
      'admin@example.com'
    )
    await userEvent.type(
      screen.getByPlaceholderText('Min 8 characters'),
      'password123'
    )
    await submit()
    expect(await screen.findByText('Required')).toBeInTheDocument()
  })

  it('rejects a password shorter than 8 characters', async () => {
    let called = false
    server.use(
      postBootstrapHandler(() => {
        called = true
        return postBootstrapHandlerResponse201({ message: 'ok' })
      })
    )
    renderBootstrap()
    await fillForm('short')
    await submit()
    // Placeholders are not text content, so this only matches the error.
    expect(await screen.findByText('Min 8 characters')).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('calls POST /bootstrap with the form values and navigates to login', async () => {
    let capturedBody: PostBootstrapMutationRequest | undefined
    server.use(
      postBootstrapHandler(async (info) => {
        capturedBody =
          (await info.request.json()) as PostBootstrapMutationRequest
        return postBootstrapHandlerResponse201({ message: 'ok' })
      })
    )
    renderBootstrap()
    await fillForm()
    await submit()

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
    )
    expect(capturedBody).toEqual({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'password123',
    })
  })

  it('shows the API error message and stays on the page', async () => {
    server.use(
      postBootstrapHandler(() =>
        postBootstrapHandlerResponse409({ message: 'System already set up' })
      )
    )
    renderBootstrap()
    await fillForm()
    await submit()

    expect(await screen.findByText('System already set up')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('clears the previous error on resubmit', async () => {
    server.use(
      postBootstrapHandler(() =>
        postBootstrapHandlerResponse409({ message: 'System already set up' })
      )
    )
    renderBootstrap()
    await fillForm()
    await submit()
    await screen.findByText('System already set up')

    server.use(
      postBootstrapHandler(() =>
        postBootstrapHandlerResponse201({ message: 'ok' })
      )
    )
    await submit()

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
    )
    expect(screen.queryByText('System already set up')).not.toBeInTheDocument()
  })
})
