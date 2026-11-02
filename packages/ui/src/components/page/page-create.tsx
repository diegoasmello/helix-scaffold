import type { ReactNode } from 'react'

import { PageSectionLayout } from './page-section-layout'

export interface PageCreateProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

export function PageCreate(props: Readonly<PageCreateProps>) {
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
