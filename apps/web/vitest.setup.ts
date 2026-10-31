import '@testing-library/jest-dom'
import './src/i18n'

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

// jsdom has no layout, so no scrollIntoView. Mantine's Combobox calls it when
// typing in a searchable Select.
Element.prototype.scrollIntoView = vi.fn()

window.getSelection = () =>
  ({
    addRange: vi.fn(),
    removeAllRanges: vi.fn(),
    getRangeAt: vi.fn().mockReturnValue({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      cloneRange: vi.fn().mockReturnThis(),
      collapse: vi.fn(),
      compareBoundaryPoints: vi.fn().mockReturnValue(0),
    }),
    rangeCount: 0,
    focusNode: null,
    focusOffset: 0,
    anchorNode: null,
    anchorOffset: 0,
    isCollapsed: true,
    type: 'None',
    collapse: vi.fn(),
    collapseToStart: vi.fn(),
    collapseToEnd: vi.fn(),
    deleteFromDocument: vi.fn(),
    extend: vi.fn(),
    selectAllChildren: vi.fn(),
    setPosition: vi.fn(),
    setBaseAndExtent: vi.fn(),
    toString: vi.fn().mockReturnValue(''),
    containsNode: vi.fn().mockReturnValue(false),
    empty: vi.fn(),
    modify: vi.fn(),
  }) as unknown as Selection
