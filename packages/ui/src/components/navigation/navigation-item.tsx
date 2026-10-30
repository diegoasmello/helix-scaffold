import { css } from '@emotion/react'
import { UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight, type IconProps } from '@tabler/icons-react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import type { RefAttributes } from 'react'

export interface NavigationItemProps {
  label: string
  active?: boolean
  chevron?: boolean
  chevronOpen?: boolean
  icon?: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  to?: string
  onClick?: () => void
  px?: string
}

export function NavigationItem(props: Readonly<NavigationItemProps>) {
  const {
    label,
    active,
    chevron,
    chevronOpen,
    icon: Icon,
    to,
    onClick,
    px = '0',
  } = props

  const matchRoute = useMatchRoute()
  const isActive =
    active ??
    (to !== undefined ? Boolean(matchRoute({ to, fuzzy: true })) : false)

  const { classes, cx } = useStyles({ px })

  const rootClass = cx(classes.navItem, { [classes.navItemActive]: isActive })

  const content = (
    <>
      <div className={classes.inner}>
        {Icon && (
          <Icon
            size={18}
            className={cx(classes.icon, { [classes.iconActive]: isActive })}
          />
        )}
        <span
          className={cx(classes.label, { [classes.labelActive]: isActive })}
        >
          {label}
        </span>
      </div>
      {chevron && (
        <IconChevronRight
          className={cx(classes.chevron, {
            [classes.chevronRotated]: chevronOpen,
            [classes.chevronActive]: isActive,
          })}
          stroke={1.5}
          size={16}
        />
      )}
    </>
  )

  if (to !== undefined) {
    return (
      <Link to={to} className={rootClass}>
        {content}
      </Link>
    )
  }

  return (
    <UnstyledButton onClick={onClick} className={rootClass}>
      {content}
    </UnstyledButton>
  )
}

const useStyles = createStyles((theme, params: { px: string }, u) => ({
  navItem: css`
    display: flex;
    align-items: center;
    width: 100%;
    height: 3rem;
    position: relative;
    text-decoration: none;
    color: inherit;
    background-color: transparent;
    padding: 0 ${params.px};
    outline: none;

    &:focus div,
    &:focus-within div {
      outline-offset: 2px;

      ${u.light} {
        outline: 2px solid ${theme.colors.main[6]};
      }
      ${u.dark} {
        outline: 2px solid ${theme.colors.main[3]};
      }
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
  navItemActive: css`
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
  inner: css`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    height: 100%;
    padding: 0 1rem;
    border-radius: ${theme.radius.lg};
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
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
      color: ${theme.colors.main[3]};
    }
  `,
  label: css`
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.154px;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));
    line-height: normal;
  `,
  labelActive: css`
    ${u.light} {
      color: ${theme.colors.main[6]};
    }
    ${u.dark} {
      color: ${theme.colors.main[3]};
    }
  `,
  chevron: css`
    transition:
      transform 200ms ease,
      color 200ms ease;
    flex-shrink: 0;
    color: light-dark(rgba(0, 0, 0, 0.35), rgba(255, 255, 255, 0.35));
  `,
  chevronRotated: css`
    transform: rotate(-90deg);
  `,
  chevronActive: css`
    ${u.light} {
      color: ${theme.colors.main[6]};
    }
    ${u.dark} {
      color: ${theme.colors.main[3]};
    }
  `,
}))
