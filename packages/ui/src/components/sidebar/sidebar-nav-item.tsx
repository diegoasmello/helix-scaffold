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
    <>
      {!nested && (
        <div
          className={cx(classes.indicator, {
            [classes.indicatorActive]: active,
          })}
        />
      )}
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
    </>
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
    height: 49px;
    padding: 0 16px 0 20px;
    position: relative;
    text-decoration: none;
    color: inherit;
    background-color: transparent;

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[0]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
      }
    }
  `,
  nestedControl: css`
    padding-left: 56px;
  `,
  activeControl: css`
    ${u.light} {
      background-color: ${theme.colors.main[0]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[5]};
    }
  `,
  indicator: css`
    position: absolute;
    left: 0;
    top: 8.5px;
    width: 4px;
    height: 32px;
    border-radius: 0 100px 100px 0;
    background-color: transparent;
    flex-shrink: 0;
  `,
  indicatorActive: css`
    background-color: ${theme.colors.main[6]};
  `,
  inner: css`
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  `,
  icon: css`
    color: light-dark(rgba(0, 0, 0, 0.4), rgba(255, 255, 255, 0.4));
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
    font-weight: 600;
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
