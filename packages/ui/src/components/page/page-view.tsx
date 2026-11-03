import type { ReactNode } from 'react'

import { PageSectionLayout } from './page-section-layout'

export interface PageViewProps {
  title: ReactNode
  /** Under the title. */
  description?: ReactNode
  /** Next to the title — e.g. the record's `StatusBadge`. */
  titleAside?: ReactNode
  /** Header buttons. Fill the width on phones. */
  actions?: ReactNode
  /** Sub-page navigation (`PageTabs`) at the bottom of the header. */
  tabs?: ReactNode
  /** Bar pinned to the bottom of the screen. */
  footerActions?: ReactNode
  children: ReactNode
}

/**
 * The detail page: the record as title, header actions (Edit, Delete) and its
 * fields as `LabeledValue`s in a grid. See `PageSectionLayout`.
 */
export function PageView(props: Readonly<PageViewProps>) {
  return <PageSectionLayout {...props} />
}
