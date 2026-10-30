import { css } from '@emotion/react'
import { Box, Flex, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconChevronLeft } from '@tabler/icons-react'
import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SidebarContext } from './sidebar-context'
import { SidebarLinksGroup } from './sidebar-links-group'
import type { SidebarGroup } from './types'

export interface SidebarProps {
  groups: SidebarGroup[]
  expandedLogo: ReactNode
  collapsedLogo: ReactNode
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export function Sidebar(props: Readonly<SidebarProps>) {
  const {
    groups,
    expandedLogo,
    collapsedLogo,
    collapsed = false,
    onToggleCollapsed,
  } = props

  const { t } = useTranslation('ui')
  const [hovered, setHovered] = useState(false)
  const [focusedAt, setFocusedAt] = useState<string | null>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const focused = focusedAt === pathname

  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peekExpanded = hovered || focused
  const visuallyCollapsed = collapsed && !peekExpanded

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setHovered(true), 300)
  }

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current)
      hoverTimeout.current = null
    }
    setHovered(false)
  }

  const handleFocus = () => {
    if (collapsed) setFocusedAt(pathname)
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setFocusedAt(null)
    }
  }

  const { classes, cx } = useStyles()

  return (
    <SidebarContext.Provider value={{ collapsed: visuallyCollapsed }}>
      <Box
        className={cx(
          classes.sidebar,
          !collapsed && classes.sidebarExpanded,
          collapsed && classes.sidebarAbsolute,
          collapsed && !peekExpanded && classes.sidebarCollapsedWidth,
          collapsed && peekExpanded && classes.sidebarPeekWidth
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <Flex direction="column" h="100%" w="100%" gap="md">
          <Flex
            justify={visuallyCollapsed ? 'center' : 'space-between'}
            align="center"
            className={classes.header}
          >
            <Link to="/">
              {visuallyCollapsed ? collapsedLogo : expandedLogo}
            </Link>
            {!visuallyCollapsed && (
              <UnstyledButton
                onClick={onToggleCollapsed}
                className={classes.toggleButton}
                aria-label={
                  collapsed ? t('sidebar.expand') : t('sidebar.collapse')
                }
              >
                <IconChevronLeft
                  size={16}
                  stroke={1.5}
                  className={cx(classes.toggleIcon, {
                    [classes.toggleIconCollapsed]: collapsed,
                  })}
                />
              </UnstyledButton>
            )}
          </Flex>

          <ScrollArea className={classes.scrollArea}>
            <div className={classes.scrollAreaInner}>
              {groups.map((group, index) => (
                <div key={group.title ?? index} className={classes.group}>
                  {group.title && (
                    <Text
                      className={cx(classes.groupTitle, {
                        [classes.groupTitleHidden]: visuallyCollapsed,
                      })}
                    >
                      {group.title}
                    </Text>
                  )}
                  <nav className={classes.nav}>
                    {group.items.map((item) => (
                      <SidebarLinksGroup
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        initiallyOpened={item.initiallyOpened}
                        links={item.links}
                        to={item.to}
                      />
                    ))}
                  </nav>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Flex>
      </Box>
    </SidebarContext.Provider>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  sidebar: css`
    height: 100%;
    padding: ${theme.spacing.md};
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    ${u.light} {
      background-color: ${theme.white};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[7]};
    }
  `,
  sidebarExpanded: css`
    width: 100%;
  `,
  sidebarAbsolute: css`
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 200;
    transition:
      width 250ms ease,
      box-shadow 250ms ease;
  `,
  sidebarCollapsedWidth: css`
    width: 72px;
  `,
  sidebarPeekWidth: css`
    width: 280px;
    ${u.light} {
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.08);
    }
    ${u.dark} {
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
    }
  `,
  header: css`
    flex-shrink: 0;
    min-height: 24px;
  `,
  toggleButton: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${theme.radius.sm};
    flex-shrink: 0;
    ${u.light} {
      color: ${theme.colors.gray[5]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[3]};
    }

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[1]};
        color: ${theme.colors.gray[7]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[5]};
        color: ${theme.colors.dark[0]};
      }
    }
  `,
  toggleIcon: css`
    transition: transform 250ms ease;
  `,
  toggleIconCollapsed: css`
    transform: rotate(180deg);
  `,
  scrollArea: css`
    flex: 1;
    width: calc(100% + ${theme.spacing.md} * 2);
    margin-left: calc(${theme.spacing.md} * -1);
    margin-right: calc(${theme.spacing.md} * -1);
    /* Pulled up by the focus ring extent (2px outline + 2px offset) and
       padded back below, so the viewport doesn't clip the first item's ring */
    margin-top: -4px;
  `,
  scrollAreaInner: css`
    padding-top: 4px;
    padding-bottom: ${theme.spacing.xl};
  `,
  group: css`
    &:not(:first-of-type) {
      margin-top: ${theme.spacing.xs};
    }
  `,
  groupTitleHidden: css`
    visibility: hidden;
  `,
  groupTitle: css`
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    padding-left: 20px;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[3]};
    }
  `,
  nav: css`
    display: grid;
    gap: 0.25rem;
  `,
}))
