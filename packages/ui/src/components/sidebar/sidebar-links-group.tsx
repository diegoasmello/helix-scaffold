import { css } from '@emotion/react'
import { Collapse, Group, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronRight, type IconProps } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
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

  const { classes } = useStyles()
  const hasLinks = Array.isArray(links)
  const [opened, setOpened] = useState(initiallyOpened || false)

  return (
    <>
      <UnstyledButton
        onClick={() => setOpened((o) => !o)}
        className={classes.control}
      >
        {!hasLinks && (
          <Link to={to}>
            <SidebarLinksGroupItem icon={Icon} label={label} />
          </Link>
        )}

        {hasLinks && (
          <Group justify="space-between" gap={0}>
            <SidebarLinksGroupItem icon={Icon} label={label} />
            <IconChevronRight
              className={classes.chevron}
              stroke={1.5}
              size={16}
              style={{ transform: opened ? 'rotate(-90deg)' : 'none' }}
            />
          </Group>
        )}
      </UnstyledButton>

      {hasLinks ? (
        <Collapse expanded={opened}>
          {links.map((link) => (
            <Link to={link.to} key={link.label} className={classes.link}>
              {link.label}
            </Link>
          ))}
        </Collapse>
      ) : null}
    </>
  )
}

const useStyles = createStyles((theme) => ({
  control: css`
    font-weight: 500;
    display: block;
    width: 100%;
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    color: var(--mantine-color-text);
    font-size: ${theme.fontSizes.sm};

    &:hover {
      background-color: light-dark(
        var(--mantine-color-gray-0),
        var(--mantine-color-dark-7)
      );
      color: light-dark(
        var(--mantine-color-black),
        var(--mantine-color-dark-0)
      );
    }
  `,
  link: css`
    font-weight: 500;
    display: block;
    text-decoration: none;
    padding: var(--mantine-spacing-xs) var(--mantine-spacing-md);
    padding-left: var(--mantine-spacing-md);
    margin-left: var(--mantine-spacing-xl);
    font-size: var(--mantine-font-size-sm);
    color: light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-0));
    border-left: 1px solid
      light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-4));

    &:hover {
      background-color: light-dark(
        var(--mantine-color-gray-0),
        var(--mantine-color-dark-7)
      );
      color: light-dark(
        var(--mantine-color-black),
        var(--mantine-color-dark-0)
      );
    }
  `,
  chevron: css`
    transition: transform 200ms ease;
  `,
}))
