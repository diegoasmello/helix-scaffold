import { css } from '@emotion/react'
import { Box, Flex, ScrollArea, Text, UnstyledButton } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconLayoutSidebarLeftCollapse, IconX } from '@tabler/icons-react'
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
  /**
   * Inside the mobile drawer: no collapse toggle and no border; a close button
   * calls this instead.
   */
  onClose?: () => void
}

export function Sidebar(props: Readonly<SidebarProps>) {
  const {
    groups,
    expandedLogo,
    collapsedLogo,
    collapsed = false,
    onToggleCollapsed,
    onClose,
  } = props

  const inDrawer = onClose !== undefined

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
          !inDrawer && classes.sidebarBordered,
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
            {inDrawer ? (
              <UnstyledButton
                onClick={onClose}
                className={classes.toggleButton}
                aria-label={t('sidebar.close')}
              >
                <IconX size={20} stroke={1.7} />
              </UnstyledButton>
            ) : (
              !visuallyCollapsed && (
                <UnstyledButton
                  onClick={onToggleCollapsed}
                  className={classes.toggleButton}
                  aria-label={
                    collapsed ? t('sidebar.expand') : t('sidebar.collapse')
                  }
                >
                  <IconLayoutSidebarLeftCollapse
                    size={18}
                    stroke={1.7}
                    className={cx(classes.toggleIcon, {
                      [classes.toggleIconCollapsed]: collapsed,
                    })}
                  />
                </UnstyledButton>
              )
            )}
          </Flex>

          <ScrollArea
            className={classes.scrollArea}
            scrollbars="y"
            classNames={{ content: classes.scrollContent }}
          >
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
                        badge={item.badge}
                        action={item.action}
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
    box-sizing: border-box;
    padding: ${theme.spacing.md} 14px 0;
    display: flex;
    flex-direction: column;
    ${u.light} {
      background-color: ${theme.colors.gray[0]};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[7]};
    }
  `,
  sidebarBordered: css`
    ${u.light} {
      border-right: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border-right: 1px solid ${theme.colors.dark[5]};
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
    transition: width 250ms ease;
  `,
  sidebarCollapsedWidth: css`
    width: 72px;
  `,
  sidebarPeekWidth: css`
    width: 272px;
  `,
  header: css`
    flex-shrink: 0;
    min-height: 40px;
    padding-left: 10px;
  `,
  toggleButton: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    flex-shrink: 0;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }

    &:hover {
      ${u.light} {
        background-color: ${theme.colors.gray[2]};
        color: ${theme.colors.gray[8]};
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
    width: calc(100% + 28px);
    margin-left: -14px;
    margin-right: -14px;
    /* Pulled up by the focus ring extent (2px outline + 2px offset) and
       padded back below, so the viewport doesn't clip the first item's ring */
    margin-top: -4px;
  `,
  /* Mantine lays the content out as a table, which grows to its widest
     child — keep it at the viewport's width. */
  scrollContent: css`
    && {
      display: block;
    }
  `,
  scrollAreaInner: css`
    padding: 4px 14px ${theme.spacing.xl};
  `,
  group: css`
    &:not(:first-of-type) {
      margin-top: 22px;
    }
  `,
  groupTitleHidden: css`
    visibility: hidden;
  `,
  groupTitle: css`
    font-size: 12.5px;
    font-weight: 500;
    padding: 0 ${theme.spacing.sm} 6px;
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[3]};
    }
  `,
  nav: css`
    display: grid;
    /* An implicit (auto) column never gets narrower than its widest item's
       content, so a long label would push the entry past the sidebar instead
       of truncating. minmax(0, 1fr) caps the column at the sidebar's width. */
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  `,
}))
