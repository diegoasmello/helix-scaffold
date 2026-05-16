import { css } from '@emotion/react'
import { Flex, type FlexProps, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

export interface LabeledValueProps extends FlexProps {
  label: string
  children: ReactNode | undefined | null
}

export function LabeledValue(props: Readonly<LabeledValueProps>) {
  const { label, children, ...rest } = props

  const { classes } = useStyles()

  return (
    <Flex direction="column" gap={4} {...rest}>
      <Text
        size="xs"
        fw={600}
        tt="uppercase"
        c="dimmed"
        className={classes.label}
      >
        {label}
      </Text>
      {children ?? <Text size="md">-</Text>}
    </Flex>
  )
}

const useStyles = createStyles(() => ({
  label: css`
    letter-spacing: 0.5px;
  `,
}))
