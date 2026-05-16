import { css } from '@emotion/react'
import { Box, Flex, ScrollArea, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

import { SidebarLinksGroup } from './sidebar-links-group'
import type { SidebarGroup } from './types'

export interface SidebarProps {
  groups: SidebarGroup[]
  logo?: ReactNode
}

export function Sidebar(props: Readonly<SidebarProps>) {
  const { groups, logo } = props

  const { classes } = useStyles()

  return (
    <Box className={classes.sidebar}>
      <Flex direction="column" align="flex-start" h="100%" w="100%" gap="md">
        {logo}
        <ScrollArea className={classes.scrollArea}>
          <div className={classes.scrollAreaInner}>
            {groups.map((group, index) => (
              <div key={group.title ?? index} className={classes.group}>
                {group.title && (
                  <Text className={classes.groupTitle}>{group.title}</Text>
                )}
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
              </div>
            ))}
          </div>
        </ScrollArea>
      </Flex>
    </Box>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  sidebar: css`
    height: 100%;
    width: 100%;
    padding: ${theme.spacing.md};
    padding-bottom: 0;
    display: flex;
    flex-direction: column;
    ${u.light} {
      background-color: ${theme.white};
    }
    ${u.dark} {
      background-color: ${theme.colors.dark[6]};
    }
  `,
  scrollArea: css`
    flex: 1;
    width: calc(100% + ${theme.spacing.md} * 2);
    margin-left: calc(${theme.spacing.md} * -1);
    margin-right: calc(${theme.spacing.md} * -1);
  `,
  scrollAreaInner: css`
    padding-bottom: ${theme.spacing.xl};
  `,
  group: css`
    &:not(:first-of-type) {
      margin-top: ${theme.spacing.xs};
    }
  `,
  groupTitle: css`
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding: ${theme.spacing.xs} ${theme.spacing.md};
    padding-left: 20px;
    ${u.light} {
      color: ${theme.colors.dark[3]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[3]};
    }
  `,
}))
