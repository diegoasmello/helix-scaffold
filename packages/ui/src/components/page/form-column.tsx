import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

export interface FormColumnProps {
  /** The fields. */
  children: ReactNode
}

/**
 * The fields of a short form page (`PageCreate`, `PageEdit`) in one column,
 * up to 720px wide. Longer forms group their fields in `FormSection`s instead.
 */
export function FormColumn(props: Readonly<FormColumnProps>) {
  const { children } = props

  const { classes } = useStyles()

  return <div className={classes.root}>{children}</div>
}

const useStyles = createStyles(() => ({
  root: css`
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  `,
}))
