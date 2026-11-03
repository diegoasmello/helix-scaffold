import {
  DocumentTitle,
  DocumentTitleProvider,
  MantineEmotionProvider,
  MantineProvider,
  PageList,
  PageView,
} from '@helix/ui'
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function renderWithTemplate(ui: ReactNode) {
  return render(
    <MantineProvider>
      <MantineEmotionProvider>
        <DocumentTitleProvider template="%s | Helix">
          {ui}
        </DocumentTitleProvider>
      </MantineEmotionProvider>
    </MantineProvider>
  )
}

describe('document title', () => {
  // The static title of index.html, shown when no page sets one.
  let staticTitle: HTMLTitleElement

  beforeEach(() => {
    staticTitle = document.createElement('title')
    staticTitle.textContent = 'Helix'
    document.head.append(staticTitle)
  })

  afterEach(() => {
    // Unmount first: React removes the titles it rendered itself.
    cleanup()
    staticTitle.remove()
  })

  it("uses the page header's title, followed by the product name", () => {
    renderWithTemplate(<PageList title="Todos">content</PageList>)

    expect(document.title).toBe('Todos | Helix')
  })

  it('uses the record on a detail page', () => {
    renderWithTemplate(<PageView title="Review quarterly report">x</PageView>)

    expect(document.title).toBe('Review quarterly report | Helix')
  })

  it('follows the page title when it changes', () => {
    const { rerender } = renderWithTemplate(
      <PageList title="Todos">content</PageList>
    )

    rerender(
      <MantineProvider>
        <MantineEmotionProvider>
          <DocumentTitleProvider template="%s | Helix">
            <PageList title="Tarefas">content</PageList>
          </DocumentTitleProvider>
        </MantineEmotionProvider>
      </MantineProvider>
    )

    expect(document.title).toBe('Tarefas | Helix')
  })

  it('goes back to the static title when the page unmounts', () => {
    const { unmount } = renderWithTemplate(
      <PageList title="Todos">content</PageList>
    )

    unmount()

    expect(document.title).toBe('Helix')
  })

  it('works on pages without a page header', () => {
    renderWithTemplate(<DocumentTitle title="Sign in" />)

    expect(document.title).toBe('Sign in | Helix')
  })

  it('shows the page title alone without a provider', () => {
    render(<DocumentTitle title="Sign in" />)

    expect(document.title).toBe('Sign in')
  })
})
