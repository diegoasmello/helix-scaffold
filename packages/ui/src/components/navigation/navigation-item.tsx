import { css } from '@emotion/react'
import { Tooltip, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight, type IconProps } from '@tabler/icons-react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { type ReactNode, type RefAttributes, useRef, useState } from 'react'

export interface NavigationItemProps {
  label: string
  active?: boolean
  chevron?: boolean
  chevronOpen?: boolean
  icon?: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  to?: string
  onClick?: () => void
  /** `nested` entries (sub-menus) are a step shorter and carry no icon. */
  size?: 'default' | 'nested'
  /** Rendered after the label — a count badge. */
  badge?: ReactNode
  /** Rendered after the entry, outside the link — e.g. a "+" button. */
  action?: ReactNode
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
    size = 'default',
    badge,
    action,
  } = props

  const matchRoute = useMatchRoute()
  const isActive =
    active ??
    (to !== undefined ? Boolean(matchRoute({ to, fuzzy: true })) : false)

  const { classes, cx } = useStyles()

  // The full label in a tooltip, only while it is cut off with an ellipsis.
  const labelRef = useRef<HTMLSpanElement>(null)
  const [showFullLabel, setShowFullLabel] = useState(false)

  const handleLabelReveal = () => {
    const el = labelRef.current
    setShowFullLabel(!!el && el.scrollWidth > el.clientWidth)
  }

  const handleLabelHide = () => setShowFullLabel(false)

  const content = (
    <>
      {Icon && (
        <Icon
          size={20}
          stroke={1.7}
          className={cx(classes.icon, { [classes.iconActive]: isActive })}
        />
      )}
      <Tooltip
        label={label}
        opened={showFullLabel}
        position="right"
        withArrow
        offset={16}
      >
        <span ref={labelRef} className={classes.label}>
          {label}
        </span>
      </Tooltip>
      {badge}
      {chevron && (
        <IconChevronRight
          className={cx(classes.chevron, {
            [classes.chevronRotated]: chevronOpen,
          })}
          stroke={1.7}
          size={16}
        />
      )}
    </>
  )

  const controlClass = cx(classes.control, {
    [classes.controlNested]: size === 'nested',
  })

  const control =
    to !== undefined ? (
      <Link
        to={to}
        className={controlClass}
        aria-current={isActive ? 'page' : undefined}
      >
        {content}
      </Link>
    ) : (
      <UnstyledButton
        onClick={onClick}
        className={controlClass}
        aria-expanded={chevron ? Boolean(chevronOpen) : undefined}
      >
        {content}
      </UnstyledButton>
    )

  return (
    <div
      className={cx(classes.item, {
        [classes.itemActive]: isActive,
        [classes.itemNested]: size === 'nested',
        [classes.itemWithAction]: !!action,
      })}
      onMouseEnter={handleLabelReveal}
      onMouseLeave={handleLabelHide}
      onFocus={handleLabelReveal}
      onBlur={handleLabelHide}
    >
      {control}
      {action}
    </div>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  item: css`
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid transparent;
    border-radius: ${theme.radius.lg};
    transition: background-color 150ms ease;

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[6]};
      }
    }
  `,
  itemNested: css`
    border-radius: ${theme.radius.md};
  `,
  itemWithAction: css`
    padding-right: 6px;
  `,
  itemActive: css`
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
  control: css`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    height: 42px;
    padding: 0 ${theme.spacing.sm};
    border-radius: inherit;
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.2;
    ${u.light} {
      color: ${theme.colors.gray[8]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[1]};
    }

    &:focus-visible {
      outline-offset: 2px;
      animation: var(--helix-focus-ring-animation);
      ${u.light} {
        outline: 2px solid ${theme.colors.main[6]};
      }
      ${u.dark} {
        outline: 2px solid ${theme.colors.main[3]};
      }
    }

    &[aria-current='page'] {
      ${u.light} {
        color: ${theme.colors.gray[9]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[0]};
      }
    }
  `,
  controlNested: css`
    height: 38px;
    font-size: 14.5px;
  `,
  icon: css`
    flex-shrink: 0;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
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
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  chevron: css`
    flex-shrink: 0;
    transition: transform 200ms ease;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
  `,
  chevronRotated: css`
    transform: rotate(90deg);
  `,
}))
