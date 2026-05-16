import { css } from '@emotion/react'
import { Collapse, Group, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight, type IconProps } from '@tabler/icons-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { type RefAttributes, useState } from 'react'

import { SidebarLinksGroupItem } from './sidebar-links-group-item'
import type { SidebarLink } from './types'

export interface SidebarLinksGroupProps {
  icon: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  label: string
  initiallyOpened?: boolean
  links?: SidebarLink[]
  to?: string
}

export function SidebarLinksGroup(props: Readonly<SidebarLinksGroupProps>) {
  const { icon: Icon, label, initiallyOpened, links, to } = props

  const { classes, cx } = useStyles()
  const hasLinks = Array.isArray(links)
  const [opened, setOpened] = useState(initiallyOpened || false)

  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const isActive =
    !hasLinks && !!to && (pathname === to || pathname.startsWith(to + '/'))

  const isGroupActive =
    hasLinks &&
    links.some(
      (link) =>
        pathname === link.to || pathname.startsWith(String(link.to) + '/')
    )

  return (
    <>
      {!hasLinks && !!to ? (
        <Link
          to={to}
          className={cx(classes.control, { [classes.activeControl]: isActive })}
        >
          <div
            className={cx(classes.indicator, {
              [classes.indicatorActive]: isActive,
            })}
          />
          <SidebarLinksGroupItem icon={Icon} label={label} active={isActive} />
        </Link>
      ) : (
        <UnstyledButton
          onClick={() => setOpened((o) => !o)}
          className={cx(classes.control, {
            [classes.activeControl]: isGroupActive,
          })}
        >
          <div
            className={cx(classes.indicator, {
              [classes.indicatorActive]: isGroupActive,
            })}
          />
          <Group justify="space-between" gap={0} style={{ flex: 1, minWidth: 0 }}>
            <SidebarLinksGroupItem
              icon={Icon}
              label={label}
              active={isGroupActive}
            />
            <IconChevronRight
              className={cx(classes.chevron, {
                [classes.chevronActive]: isGroupActive,
              })}
              stroke={1.5}
              size={16}
              style={{ transform: opened ? 'rotate(-90deg)' : 'none' }}
            />
          </Group>
        </UnstyledButton>
      )}

      {hasLinks && (
        <Collapse expanded={opened}>
          {links.map((link) => {
            const isLinkActive =
              pathname === link.to ||
              pathname.startsWith(String(link.to) + '/')
            return (
              <Link
                to={link.to}
                key={link.label}
                className={cx(classes.link, {
                  [classes.linkActive]: isLinkActive,
                })}
              >
                {link.label}
              </Link>
            )
          })}
        </Collapse>
      )}
    </>
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
  link: css`
    display: flex;
    align-items: center;
    height: 49px;
    padding: 0 16px 0 56px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.154px;
    text-decoration: none;
    color: light-dark(rgba(0, 0, 0, 0.7), rgba(255, 255, 255, 0.7));

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[0]};
        color: rgba(0, 0, 0, 0.7);
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
        color: rgba(255, 255, 255, 0.7);
      }
    }
  `,
  linkActive: css`
    color: ${theme.colors.main[6]};
    font-weight: 600;
    ${u.light} {
      background-color: ${theme.colors.main[0]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[5]};
    }
  `,
  chevron: css`
    transition: transform 200ms ease, color 200ms ease;
    flex-shrink: 0;
    color: light-dark(rgba(0, 0, 0, 0.35), rgba(255, 255, 255, 0.35));
  `,
  chevronActive: css`
    color: ${theme.colors.main[6]};
  `,
}))
