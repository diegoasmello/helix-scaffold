import { Flex, Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageListProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageList(props: Readonly<PageListProps>) {
  const { title, description, actions, children } = props

  return (
    <Flex direction="column" gap="lg">
      <Group justify="space-between" align="center">
        <Flex direction="column" gap={8}>
          <Title order={2}>{title}</Title>
          {description && (
            <Text maw="420" size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Flex>
        {actions}
      </Group>
      {children}
    </Flex>
  )
}
