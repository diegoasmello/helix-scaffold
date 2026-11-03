import { css } from '@emotion/react'
import { Text, Title } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

import { RouteBreadcrumb } from '../breadcrumb/route-breadcrumb'
import { DocumentTitle } from '../document-title/document-title'

export interface PageHeaderProps {
  /**
   * The `h1`. When it is a string it is also the browser tab title
   * (`DocumentTitle`, in the `DocumentTitleProvider` format).
   */
  title: ReactNode
  description?: ReactNode
  /** Next to the title — e.g. a status badge. */
  titleAside?: ReactNode
  /** Right side — the page's buttons. Wraps under the title on small screens. */
  actions?: ReactNode
  /**
   * The route's breadcrumb above the title. Defaults to `true`; detail and
   * form pages turn it off — there it only takes room.
   */
  withBreadcrumb?: boolean
  /** Below `sm`, the actions fill the width in equal columns. */
  fullWidthActionsOnMobile?: boolean
}

/**
 * The top of every page: the route's breadcrumb (lists and custom pages), the
 * `h1` title (also the browser tab title), an optional description and the
 * page actions. Used by `PageList`, `PageCreate`, `PageEdit` and `PageView`;
 * use it directly on custom pages.
 */
export function PageHeader(props: Readonly<PageHeaderProps>) {
  const {
    title,
    description,
    titleAside,
    actions,
    withBreadcrumb = true,
    fullWidthActionsOnMobile = false,
  } = props

  const { classes, cx } = useStyles()

  return (
    <header className={classes.root}>
      {typeof title === 'string' && <DocumentTitle title={title} />}
      <div className={classes.heading}>
        {withBreadcrumb && <RouteBreadcrumb />}
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
      {actions && (
        <div
          className={cx(
            classes.actions,
            fullWidthActionsOnMobile && classes.actionsFullWidth
          )}
        >
          {actions}
        </div>
      )}
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

    h1 {
      overflow-wrap: anywhere;
    }

    @media (max-width: calc(${theme.breakpoints.sm} - 0.0625em)) {
      h1 {
        font-size: 26px;
        line-height: 1.25;
      }
    }
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
  actionsFullWidth: css`
    @media (max-width: calc(${theme.breakpoints.sm} - 0.0625em)) {
      width: 100%;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);

      /* Buttons wrapped in a Group or a permission check still get a column. */
      & > .mantine-Group-root {
        display: contents;
      }
      & .mantine-Button-root {
        height: 46px;
      }
    }
  `,
}))
