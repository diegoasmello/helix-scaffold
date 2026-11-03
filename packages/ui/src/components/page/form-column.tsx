import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'

import { FORM_MAX_WIDTH } from './form-widths'

export interface FormColumnProps {
  /** The fields. */
  children: ReactNode
}

/**
 * The fields of a short form page (`PageCreate`, `PageEdit`) in one column,
 * as wide as a sectioned form. Longer forms group their fields in
 * `FormSection`s instead.
 */
export function FormColumn(props: Readonly<FormColumnProps>) {
  const { children } = props

  const { classes } = useStyles()

  return <div className={classes.root}>{children}</div>
}

const useStyles = createStyles(() => ({
  root: css`
    width: 100%;
    max-width: ${FORM_MAX_WIDTH}px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  `,
}))
