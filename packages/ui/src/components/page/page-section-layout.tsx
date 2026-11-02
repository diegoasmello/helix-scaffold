import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

import { PageHeader } from './page-header'

export interface PageSectionLayoutProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

/** Shared body of `PageCreate`, `PageEdit` and `PageView`. */
export function PageSectionLayout(props: Readonly<PageSectionLayoutProps>) {
  const { title, actions, children, footerActions } = props

  const { classes } = useStyles()

  return (
    <div className={classes.root}>
      <PageHeader title={title} actions={actions} />
      <div className={classes.body}>{children}</div>
      {footerActions && <div className={classes.footer}>{footerActions}</div>}
    </div>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  root: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.lg};
  `,
  body: css`
    max-width: 960px;
  `,
  footer: css`
    padding-top: ${theme.spacing.md};
    ${u.light} {
      border-top: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border-top: 1px solid ${theme.colors.dark[5]};
    }
  `,
}))
