import { css } from '@emotion/react'
import { UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight, type IconProps } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { RefAttributes } from 'react'

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

  const { classes, cx } = useStyles()

  const content = (
    <div>
      <div className={classes.inner}>
        {Icon && (
          <Icon
            size={18}
            stroke={1.5}
            className={cx(classes.icon, { [classes.iconActive]: active })}
          />
        )}
        <span className={cx(classes.label, { [classes.labelActive]: active })}>
          {label}
        </span>
      </div>
      {chevron && (
        <IconChevronRight
          className={cx(classes.chevron, {
            [classes.chevronRotated]: chevronOpen,
            [classes.chevronActive]: active,
          })}
          stroke={1.5}
          size={16}
        />
      )}
    </div>
  )

  const controlClass = cx(classes.control, {
    [classes.activeControl]: active,
    [classes.nestedControl]: nested,
  })

  if (to !== undefined) {
    return (
      <Link to={to} className={controlClass}>
        {content}
      </Link>
    )
  }

  return (
    <UnstyledButton onClick={onClick} className={controlClass}>
      {content}
    </UnstyledButton>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  control: css`
    display: flex;
    align-items: center;
    width: 100%;
    height: 3rem;
    padding: 0 1rem;
    position: relative;
    text-decoration: none;
    color: inherit;
    background-color: transparent;

    & > div {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      /* padding: 0 0.75rem; */
      padding: 0 1rem;
      border-radius: ${theme.radius.lg};

      transition:
        background-color 0.3s ease,
        color 0.3s ease;
    }

    &:hover {
      & > div {
        ${u.light} {
          background-color: ${theme.colors.gray[1]};
        }
        ${u.dark} {
          background-color: ${theme.colors.dark[5]};
        }
      }
    }
  `,
  nestedControl: css`
    padding-left: 56px;
  `,
  activeControl: css`
    &,
    &:hover {
      cursor: default;

      & > div {
        ${u.light} {
          background-color: ${theme.colors.main[0]};
        }
        ${u.dark} {
          background-color: ${theme.colors.dark[5]};
        }
      }
    }
  `,
  inner: css`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    min-width: 0;
  `,
  icon: css`
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));
    flex-shrink: 0;
  `,
  iconActive: css`
    color: ${theme.colors.main[6]};
  `,
  label: css`
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.154px;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));
    line-height: normal;
  `,
  labelActive: css`
    color: ${theme.colors.main[6]};
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
    color: ${theme.colors.main[6]};
  `,
}))
