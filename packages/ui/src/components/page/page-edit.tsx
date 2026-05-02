import { Divider, Flex, Group, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export interface PageEditProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  footerActions?: ReactNode
}

export function PageEdit(props: Readonly<PageEditProps>) {
  const { title, actions, children, footerActions } = props

  return (
    <Flex direction="column" gap="md">
      <Group justify="space-between" align="center">
        <Title order={1}>{title}</Title>
        {actions}
      </Group>
      {children}
      {footerActions && (
        <>
          <Divider />
          {footerActions}
        </>
      )}
    </Flex>
  )
}
