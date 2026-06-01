import { css } from '@emotion/react'
import { UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { IconProps } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { RefAttributes } from 'react'

import { NavigationItem } from '../navigation/navigation-item'
import { useSidebar } from './sidebar-context'

export interface SidebarNavItemProps {
  label: string
  active?: boolean
  icon?: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  chevron?: boolean
  chevronOpen?: boolean
  nested?: boolean
  to?: string
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
    onClick,
  } = props

  const { collapsed } = useSidebar()
  const { classes, cx } = useStyles()

  if (collapsed) {
    const collapsedClass = cx(classes.control, classes.collapsedControl, {
      [classes.activeControl]: active,
    })
    const iconEl = Icon ? (
      <Icon
        size={18}
        className={cx(classes.icon, { [classes.iconActive]: active })}
      />
    ) : null

    if (to !== undefined) {
      return (
        <Link to={to} className={collapsedClass}>
          <div>{iconEl}</div>
        </Link>
      )
    }

    return (
      <UnstyledButton onClick={onClick} className={collapsedClass}>
        <div>{iconEl}</div>
      </UnstyledButton>
    )
  }

  const item = (
    <NavigationItem
      to={to}
      onClick={onClick}
      label={label}
      icon={Icon}
      active={active}
      chevron={chevron}
      chevronOpen={chevronOpen}
      px="1rem"
    />
  )

  if (nested) {
    return <div className={classes.nestedOffset}>{item}</div>
  }

  return item
}

const useStyles = createStyles((theme, _, u) => ({
  control: css`
    display: flex;
    align-items: center;
    width: 100%;
    height: 3rem;
    text-decoration: none;
    color: inherit;
    background-color: transparent;

    & > div {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      border-radius: ${theme.radius.lg};
      transition: background-color 0.3s ease;
    }

    &:hover > div {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
    }
  `,
  collapsedControl: css`
    justify-content: center;
    padding: 0 0.5rem;

    & > div {
      justify-content: center;
    }
  `,
  activeControl: css`
    cursor: default;

    & > div,
    &:hover > div {
      ${u.light} {
        background-color: ${theme.colors.main[0]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
    }
  `,
  icon: css`
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));
    flex-shrink: 0;
  `,
  iconActive: css`
    ${u.light} {
      color: ${theme.colors.main[6]};
    }
    ${u.dark} {
      color: ${theme.colors.main[4]};
    }
  `,
  nestedOffset: css`
    padding-left: calc(56px - ${theme.spacing.md});
  `,
}))
