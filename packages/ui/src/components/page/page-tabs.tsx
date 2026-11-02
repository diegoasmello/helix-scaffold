import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { Link, useMatchRoute } from '@tanstack/react-router'

import type { AppRoute } from '../sidebar/types'

export interface PageTab {
  label: string
  to: AppRoute
}

export interface PageTabsProps {
  /** Accessible name of the `nav`. */
  label: string
  tabs: PageTab[]
}

/**
 * A page's sub-pages as underlined tabs — route links, the active one marked
 * with `aria-current`. Pass it as `tabs` to `PageView` (it sits at the bottom
 * of the header, on its border). Scrolls sideways when it does not fit.
 */
export function PageTabs(props: Readonly<PageTabsProps>) {
  const { label, tabs } = props

  const { classes } = useStyles()
  const matchRoute = useMatchRoute()

  return (
    <nav aria-label={label} className={classes.nav}>
      {tabs.map((tab) => {
        const active = Boolean(matchRoute({ to: tab.to, fuzzy: true }))

        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={classes.tab}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  nav: css`
    display: flex;
    gap: ${theme.spacing.lg};
    overflow-x: auto;
    scrollbar-width: none;
    margin-bottom: -1px;
  `,
  tab: css`
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    height: 44px;
    padding: 0 2px;
    border-bottom: 2px solid transparent;
    font-size: 14.5px;
    font-weight: 500;
    text-decoration: none;
    border-radius: ${theme.radius.xs} ${theme.radius.xs} 0 0;
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

    &[aria-current='page'] {
      ${u.light} {
        color: ${theme.colors.gray[9]};
        border-bottom-color: ${theme.colors.gray[9]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[0]};
        border-bottom-color: ${theme.colors.dark[0]};
      }
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors[theme.primaryColor][6]};
      outline-offset: -2px;
      animation: var(--helix-focus-ring-animation);
    }
  `,
}))
