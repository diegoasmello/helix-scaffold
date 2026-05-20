import { Divider, Flex, Group, Paper, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageViewProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

export function PageView(props: Readonly<PageViewProps>) {
  const { title, actions, children, footerActions } = props

  return (
    <Flex direction="column" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>{title}</Title>
        {actions}
      </Group>
      <Paper p="24">
        {children}
        {footerActions && (
          <>
            <Divider my="xl" />
            {footerActions}
          </>
        )}
      </Paper>
    </Flex>
  )
}
