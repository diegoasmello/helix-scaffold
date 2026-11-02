import type { ReactNode } from 'react'

import { PageSectionLayout } from './page-section-layout'

export interface PageViewProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

export function PageView(props: Readonly<PageViewProps>) {
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
