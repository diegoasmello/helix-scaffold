import type { ReactNode } from 'react'

import { PageSectionLayout } from './page-section-layout'

export interface PageEditProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

export function PageEdit(props: Readonly<PageEditProps>) {
  const { title, actions, children, footerActions } = props

  return (
    <PageSectionLayout
      title={title}
      actions={actions}
      footerActions={footerActions}
    >
      {children}
    </PageSectionLayout>
  )
}
