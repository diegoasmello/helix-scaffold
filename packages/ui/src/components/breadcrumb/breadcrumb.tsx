import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'

import type { BreadcrumbItem } from '../../router'

export interface BreadcrumbProps {
  crumbs: BreadcrumbItem[]
}

export function Breadcrumb(props: Readonly<BreadcrumbProps>) {
  const { crumbs } = props

  const { classes, cx } = useStyles()

  return (
    <nav aria-label="breadcrumb" className={classes.root}>
      {crumbs.map((crumb, i) => (
        <Fragment key={`${crumb.label}-${i}`}>
          {i > 0 && (
            <IconChevronRight
              size={12}
              stroke={1.5}
              className={classes.separator}
            />
          )}
          {crumb.to ? (
            <Link to={crumb.to} className={cx(classes.item, classes.link)}>
              {crumb.label}
            </Link>
          ) : (
            <span className={cx(classes.item, classes.current)}>
              {crumb.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

const useStyles = createStyles(() => ({
  root: css`
    display: flex;
    align-items: center;
    gap: 0.5rem;
  `,
  separator: css`
    color: light-dark(rgba(0, 0, 0, 0.48), rgba(255, 255, 255, 0.24));
    flex-shrink: 0;
  `,
  item: css`
    font-size: 0.875rem;
    letter-spacing: -0.1px;
    line-height: normal;
  `,
  link: css`
    font-weight: 400;
    color: light-dark(rgba(0, 0, 0, 0.45), rgba(255, 255, 255, 0.45));
    text-decoration: none;
    transition: color 150ms ease;

    &:hover {
      color: light-dark(rgba(0, 0, 0, 0.8), rgba(255, 255, 255, 0.85));
    }
  `,
  current: css`
    font-weight: 500;
    color: light-dark(rgba(0, 0, 0, 0.8), rgba(255, 255, 255, 0.85));
  `,
}))
