import { css } from '@emotion/react'
import { Flex, Paper, Text, Title } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: string
  description?: string
  children?: ReactNode
}

export function EmptyState(props: Readonly<EmptyStateProps>) {
  const { title, description, children } = props

  const { classes } = useStyles()

  return (
    <Paper p="xl" className={classes.root}>
      <Flex direction="column" align="center" gap="lg">
        <Flex direction="column" align="center" gap="md">
          <Title order={2} className={classes.title}>
            {title}
          </Title>
          {description && (
            <Text size="md" c="dimmed" className={classes.description}>
              {description}
            </Text>
          )}
        </Flex>
        {children}
      </Flex>
    </Paper>
  )
}

const useStyles = createStyles(() => ({
  root: css`
    text-align: center;
  `,
  title: css`
    font-size: 1.25rem;
  `,
  description: css`
    max-width: 400px;
  `,
}))
