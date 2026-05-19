import { Divider, Flex, Group, Paper, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageCreateProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

export function PageCreate(props: Readonly<PageCreateProps>) {
  const { title, actions, children, footerActions } = props

  return (
    <Flex direction="column" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>{title}</Title>
        {actions}
      </Group>
      <Paper p="24" radius="lg">
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
