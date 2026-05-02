import { Flex, Group, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageListProps {
  title: string
  actions?: ReactNode
  children: ReactNode
}

export function PageList(props: Readonly<PageListProps>) {
  const { title, actions, children } = props

  return (
    <Flex direction="column" gap="md">
      <Group justify="space-between" align="center">
        <Title order={1}>{title}</Title>
        {actions}
      </Group>
      {children}
    </Flex>
  )
}
