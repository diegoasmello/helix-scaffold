import { css } from '@emotion/react'
import { Text, Title } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

import { RouteBreadcrumb } from '../breadcrumb/route-breadcrumb'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Next to the title — e.g. a status badge. */
  titleAside?: ReactNode
  /** Right side — the page's buttons. Wraps under the title on small screens. */
  actions?: ReactNode
}

/**
 * The top of every page: the route's breadcrumb, the `h1` title, an optional
 * description and the page actions. Used by `PageList`, `PageCreate`,
 * `PageEdit` and `PageView`; use it directly on custom pages.
 */
export function PageHeader(props: Readonly<PageHeaderProps>) {
  const { title, description, titleAside, actions } = props

  const { classes } = useStyles()

  return (
    <header className={classes.root}>
      <div className={classes.heading}>
        <RouteBreadcrumb />
        <div className={classes.titleRow}>
          <Title order={1}>{title}</Title>
          {titleAside}
        </div>
        {description && (
          <Text c="dimmed" className={classes.description}>
            {description}
          </Text>
        )}
      </div>
      {actions && <div className={classes.actions}>{actions}</div>}
    </header>
  )
}

const useStyles = createStyles((theme) => ({
  root: css`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${theme.spacing.md};
  `,
  heading: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  `,
  titleRow: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.spacing.sm};
  `,
  description: css`
    font-size: 15px;
    max-width: 640px;
  `,
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  `,
}))
