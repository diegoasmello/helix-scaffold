import { createContext, type ReactNode, useContext } from 'react'

const DocumentTitleTemplateContext = createContext<string | null>(null)

export interface DocumentTitleProviderProps {
  /** The browser tab title, with `%s` where the page title goes: `'%s | Helix'`. */
  template: string
  children: ReactNode
}

/**
 * Gives every `DocumentTitle` below it (and so every `PageHeader`) the app's
 * tab title format. Without it, the tab shows the page title alone.
 */
export function DocumentTitleProvider(
  props: Readonly<DocumentTitleProviderProps>
) {
  const { template, children } = props

  return (
    <DocumentTitleTemplateContext.Provider value={template}>
      {children}
    </DocumentTitleTemplateContext.Provider>
  )
}

export interface DocumentTitleProps {
  /** The page's title, as shown on the page. */
  title: string
}

/**
 * Sets the browser tab title while mounted, in the `DocumentTitleProvider`
 * format. React 19 hoists the `<title>` into `<head>`, ahead of the static one
 * in `index.html`, which comes back when the page unmounts. `PageHeader` renders
 * it from its `title`; use it directly on pages without a `PageHeader`.
 */
export function DocumentTitle(props: Readonly<DocumentTitleProps>) {
  const { title } = props

  const template = useContext(DocumentTitleTemplateContext)

  return <title>{template ? template.replace('%s', title) : title}</title>
}
