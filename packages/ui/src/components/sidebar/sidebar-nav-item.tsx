import { css } from '@emotion/react'
import { Tooltip, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconPlus, type IconProps } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { RefAttributes } from 'react'

import { NavigationItem } from '../navigation/navigation-item'
import { useSidebar } from './sidebar-context'
import type { SidebarAction, SidebarBadge } from './types'

export interface SidebarNavItemProps {
  label: string
  active?: boolean
  icon?: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  chevron?: boolean
  chevronOpen?: boolean
  nested?: boolean
  to?: string
  badge?: SidebarBadge
  action?: SidebarAction
  onClick?: () => void
}

export function SidebarNavItem(props: Readonly<SidebarNavItemProps>) {
  const {
    icon: Icon,
    label,
    active,
    chevron,
    chevronOpen,
    nested,
    to,
    badge,
    action,
    onClick,
  } = props

  const { collapsed } = useSidebar()
  const { classes, cx } = useStyles()

  if (collapsed) {
    const collapsedClass = cx(classes.collapsedControl, {
      [classes.collapsedActive]: active,
    })
    const iconEl = Icon ? (
      <Icon
        size={20}
        stroke={1.7}
        className={cx(classes.collapsedIcon, {
          [classes.collapsedIconActive]: active,
        })}
      />
    ) : null
    const dot = badge && badge.count > 0 && (
      <span
        aria-hidden
        className={cx(classes.dot, { [classes.dotHighlight]: badge.highlight })}
      />
    )

    return (
      <Tooltip label={label} position="right" withArrow>
        {to !== undefined ? (
          <Link to={to} className={collapsedClass} aria-label={label}>
            {iconEl}
            {dot}
          </Link>
        ) : (
          <UnstyledButton
            onClick={onClick}
            className={collapsedClass}
            aria-label={label}
          >
            {iconEl}
            {dot}
          </UnstyledButton>
        )}
      </Tooltip>
    )
  }

  return (
    <NavigationItem
      to={to}
      onClick={onClick}
      label={label}
      icon={Icon}
      active={active}
      chevron={chevron}
      chevronOpen={chevronOpen}
      size={nested ? 'nested' : 'default'}
      badge={
        badge && badge.count > 0 ? (
          <span
            className={cx(classes.badge, {
              [classes.badgeHighlight]: badge.highlight,
            })}
          >
            {badge.count}
          </span>
        ) : undefined
      }
      action={
        action ? (
          <Link
            to={action.to}
            aria-label={action.label}
            title={action.label}
            className={cx(classes.action, { [classes.actionNested]: nested })}
          >
            <IconPlus size={nested ? 12 : 14} stroke={2} />
          </Link>
        ) : undefined
      }
    />
  )
}

const useStyles = createStyles((theme, _, u) => ({
  badge: css`
    flex-shrink: 0;
    min-width: 24px;
    height: 22px;
    padding: 0 7px;
    box-sizing: border-box;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    ${u.light} {
      background-color: ${theme.colors.gray[2]};
      color: ${theme.colors.gray[8]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[5]};
      color: ${theme.colors.dark[0]};
    }
  `,
  badgeHighlight: css`
    ${u.light} {
      background-color: ${theme.colors.main[6]};
      color: ${theme.white};
    }
    ${u.dark} {
      background-color: ${theme.colors.main[6]};
      color: ${theme.white};
    }
  `,
  action: css`
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${theme.radius.md};
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
      background-color: ${theme.white};
      color: ${theme.colors.gray[8]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[4]};
      background-color: ${theme.colors.dark[6]};
      color: ${theme.colors.dark[0]};
    }

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors.main[6]};
      outline-offset: 2px;
      animation: var(--helix-focus-ring-animation);
    }
  `,
  actionNested: css`
    width: 26px;
    height: 26px;
  `,
  collapsedControl: css`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0 auto;
    border: 1px solid transparent;
    border-radius: ${theme.radius.lg};

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[6]};
      }
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors.main[6]};
      outline-offset: 2px;
      animation: var(--helix-focus-ring-animation);
    }
  `,
  collapsedActive: css`
    &,
    &:hover {
      ${u.light} {
        background-color: ${theme.white};
        border-color: ${theme.colors.gray[3]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[6]};
        border-color: ${theme.colors.dark[5]};
      }
    }
  `,
  collapsedIcon: css`
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
  `,
  collapsedIconActive: css`
    ${u.light} {
      color: ${theme.colors.main[6]};
    }
    ${u.dark} {
      color: ${theme.colors.main[3]};
    }
  `,
  dot: css`
    position: absolute;
    top: 9px;
    right: 9px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    ${u.light} {
      background-color: ${theme.colors.gray[5]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[2]};
    }
  `,
  dotHighlight: css`
    ${u.light} {
      background-color: ${theme.colors.main[6]};
    }
    ${u.dark} {
      background-color: ${theme.colors.main[6]};
    }
  `,
}))
