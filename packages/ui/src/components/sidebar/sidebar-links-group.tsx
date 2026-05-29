import { Collapse } from '@mantine/core'
import type { IconProps } from '@tabler/icons-react'
import { useRouterState } from '@tanstack/react-router'
import { type RefAttributes, useState } from 'react'

import { useSidebar } from './sidebar-context'
import { SidebarNavItem } from './sidebar-nav-item'
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

  const { collapsed } = useSidebar()
  const hasLinks = Array.isArray(links)
  const [opened, setOpened] = useState(initiallyOpened || false)

  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const isGroupActive =
    hasLinks &&
    links.some(
      (link) =>
        pathname === link.to || pathname.startsWith(String(link.to) + '/')
    )

  return (
    <>
      {!hasLinks && !!to ? (
        <SidebarNavItem icon={Icon} label={label} to={to} />
      ) : (
        <SidebarNavItem
          icon={Icon}
          label={label}
          active={isGroupActive || false}
          chevron
          chevronOpen={opened}
          onClick={() => setOpened((o) => !o)}
        />
      )}

      {hasLinks && !collapsed && (
        <Collapse expanded={opened}>
          {links.map((link) => (
            <SidebarNavItem
              key={link.label}
              label={link.label}
              nested
              to={link.to}
            />
          ))}
        </Collapse>
      )}
    </>
  )
}
