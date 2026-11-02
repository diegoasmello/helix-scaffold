import type { ReactNode } from 'react'

import { PageSectionLayout } from './page-section-layout'

export interface PageEditProps {
  title: ReactNode
  /** Under the title. */
  description?: ReactNode
  /** Next to the title — e.g. the record's `StatusBadge`. */
  titleAside?: ReactNode
  /** Header buttons. Fill the width on phones. */
  actions?: ReactNode
  /** Cancel/Save — pinned to the bottom of the screen. */
  footerActions?: ReactNode
  children: ReactNode
}

/**
 * The edit form: `FormSection`s, with Cancel/Save in `footerActions`. Wrap it
 * in `Form`. See `PageSectionLayout`.
 */
export function PageEdit(props: Readonly<PageEditProps>) {
  return <PageSectionLayout {...props} />
}
