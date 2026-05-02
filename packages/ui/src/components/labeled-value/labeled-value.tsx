import { Flex, type FlexProps, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export interface LabeledValueProps extends FlexProps {
  label: string
  children: ReactNode | undefined | null
}

export function LabeledValue(props: Readonly<LabeledValueProps>) {
  const { label, children, ...rest } = props

  return (
    <Flex direction="column" gap={1} {...rest}>
      <Text size="md" fw={700}>
        {label}
      </Text>
      {children ?? <Text size="md">-</Text>}
    </Flex>
  )
}
