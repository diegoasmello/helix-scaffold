import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import type { BreadcrumbItem } from '../../router'

export interface BreadcrumbProps {
  crumbs: BreadcrumbItem[]
}

export function Breadcrumb(props: Readonly<BreadcrumbProps>) {
  const { crumbs } = props

  const { t } = useTranslation('ui')
  const { classes, cx } = useStyles()

  return (
    <nav aria-label={t('breadcrumb.label')}>
      <ol className={classes.root}>
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className={classes.entry}>
            {i > 0 && (
              <IconChevronRight
                size={12}
                stroke={2}
                aria-hidden
                className={classes.separator}
              />
            )}
            {crumb.to ? (
              <Link to={crumb.to} className={cx(classes.item, classes.link)}>
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cx(classes.item, classes.current)}
                aria-current="page"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  root: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  `,
  entry: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  `,
  separator: css`
    flex-shrink: 0;
    ${u.light} {
      color: ${theme.colors.gray[5]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[3]};
    }
  `,
  item: css`
    font-size: 13px;
    line-height: 1.4;
  `,
  link: css`
    text-decoration: none;
    transition: color 150ms ease;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }

    &:hover {
      ${u.light} {
        color: ${theme.colors.gray[9]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[0]};
      }
    }
  `,
  current: css`
    font-weight: 500;
    ${u.light} {
      color: ${theme.colors.gray[8]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[1]};
    }
  `,
}))
