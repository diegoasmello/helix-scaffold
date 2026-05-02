import '@testing-library/jest-dom'

import { configure } from '@helix/api-client'

import { env } from './src/env'
import { server } from './src/mocks/server'

configure({ baseUrl: env.VITE_API_URL })

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
