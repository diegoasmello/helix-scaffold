import { css } from '@emotion/react'
import { Collapse } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { IconProps } from '@tabler/icons-react'
import { useRouterState } from '@tanstack/react-router'
import { type RefAttributes, useState } from 'react'

import { useSidebar } from './sidebar-context'
import { SidebarNavItem } from './sidebar-nav-item'
import type {
  SidebarAction,
  SidebarBadge,
  SidebarLink,
  SidebarSubLink,
} from './types'

export interface SidebarLinksGroupProps {
  icon: React.FC<IconProps & RefAttributes<SVGSVGElement>>
  label: string
  initiallyOpened?: boolean
  links?: SidebarLink[]
  to?: string
  badge?: SidebarBadge
  action?: SidebarAction
}

function isPathActive(pathname: string, to: string | undefined): boolean {
  if (!to) return false
  return pathname === to || pathname.startsWith(`${to}/`)
}

function containsActive(
  pathname: string,
  links: Array<SidebarLink | SidebarSubLink>
): boolean {
  return links.some(
    (link) =>
      isPathActive(pathname, link.to) ||
      ('links' in link && !!link.links && containsActive(pathname, link.links))
  )
}

/** A second-level entry: a page, or a group that opens a third level. */
function SidebarSubGroup(props: Readonly<{ link: SidebarLink }>) {
  const { link } = props

  const { classes } = useStyles()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hasLinks = Array.isArray(link.links) && link.links.length > 0
  const [opened, setOpened] = useState(
    link.initiallyOpened || (hasLinks && containsActive(pathname, link.links!))
  )

  if (!hasLinks) {
    return (
      <SidebarNavItem
        label={link.label}
        nested
        to={link.to}
        badge={link.badge}
        action={link.action}
      />
    )
  }

  return (
    <>
      <SidebarNavItem
        label={link.label}
        nested
        chevron
        chevronOpen={opened}
        active={false}
        badge={link.badge}
        onClick={() => setOpened((o) => !o)}
      />
      <Collapse expanded={opened}>
        <div className={classes.guide}>
          {link.links!.map((sub) => (
            <SidebarNavItem
              key={sub.label}
              label={sub.label}
              nested
              to={sub.to}
              badge={sub.badge}
              action={sub.action}
            />
          ))}
        </div>
      </Collapse>
    </>
  )
}

export function SidebarLinksGroup(props: Readonly<SidebarLinksGroupProps>) {
  const { icon: Icon, label, initiallyOpened, links, to, badge, action } = props

  const { collapsed } = useSidebar()
  const { classes } = useStyles()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hasLinks = Array.isArray(links) && links.length > 0
  const isGroupActive = hasLinks && containsActive(pathname, links)
  const [opened, setOpened] = useState(
    initiallyOpened || isGroupActive || false
  )

  if (!hasLinks) {
    return (
      <SidebarNavItem
        icon={Icon}
        label={label}
        to={to}
        badge={badge}
        action={action}
      />
    )
  }

  return (
    <>
      <SidebarNavItem
        icon={Icon}
        label={label}
        // Collapsed, the group shows only its icon: mark it when a page
        // inside is open. Expanded, the open page itself is marked.
        active={collapsed ? isGroupActive : false}
        chevron
        chevronOpen={opened}
        badge={badge}
        onClick={() => setOpened((o) => !o)}
      />

      {!collapsed && (
        <Collapse expanded={opened}>
          <div className={classes.guideFirst}>
            {links.map((link) => (
              <SidebarSubGroup key={link.label} link={link} />
            ))}
          </div>
        </Collapse>
      )}
    </>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  // Vertical guide lines that tie a sub-menu to its parent: the first one
  // sits under the parent's icon (12px padding + half of a 20px icon).
  guideFirst: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 2px 0 4px 21px;
    padding-left: ${theme.spacing.sm};
    ${u.light} {
      border-left: 1.5px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border-left: 1.5px solid ${theme.colors.dark[5]};
    }
  `,
  guide: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 2px 0 2px ${theme.spacing.sm};
    padding-left: ${theme.spacing.sm};
    ${u.light} {
      border-left: 1.5px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border-left: 1.5px solid ${theme.colors.dark[5]};
    }
  `,
}))
