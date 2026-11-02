import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

import { PageHeader } from './page-header'

export interface PageListProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageList(props: Readonly<PageListProps>) {
  const { title, description, actions, children } = props

  const { classes } = useStyles()

  return (
    <div className={classes.root}>
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  )
}

const useStyles = createStyles((theme) => ({
  root: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.lg};
  `,
}))
