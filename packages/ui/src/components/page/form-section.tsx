import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { type ReactNode, useId } from 'react'

import {
  FORM_COLUMN_GAP,
  FORM_FIELDS_MAX_WIDTH,
  FORM_INTRO_MAX_WIDTH,
} from './form-widths'

export interface FormSectionProps {
  /** The section's `h2`. */
  title: ReactNode
  /** Under the title: what the fields are for. */
  description?: ReactNode
  /** The fields. Without them the section is a title and description only. */
  children?: ReactNode
}

/**
 * A group of fields in a form page (`PageCreate`, `PageEdit`): the title and
 * description on the left, the fields on the right — stacked on narrow
 * screens.
 */
export function FormSection(props: Readonly<FormSectionProps>) {
  const { title, description, children } = props

  const { classes } = useSectionStyles()
  const titleId = useId()

  return (
    <section
      data-page-section
      aria-labelledby={titleId}
      className={classes.formSection}
    >
      <div className={classes.intro}>
        <h2 id={titleId} className={classes.title}>
          {title}
        </h2>
        {description && <p className={classes.description}>{description}</p>}
      </div>
      {children && <div className={classes.fields}>{children}</div>}
    </section>
  )
}

const useSectionStyles = createStyles((theme, _, u) => {
  const belowSm = `@media (max-width: calc(${theme.breakpoints.sm} - 0.0625em))`

  return {
    formSection: css`
      padding: 28px var(--helix-page-px, 0px);
      display: flex;
      flex-wrap: wrap;
      gap: 20px ${FORM_COLUMN_GAP}px;

      ${belowSm} {
        padding-top: 20px;
        padding-bottom: 20px;
      }
    `,
    title: css`
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    `,
    intro: css`
      flex: 1 1 240px;
      max-width: ${FORM_INTRO_MAX_WIDTH}px;
      display: flex;
      flex-direction: column;
      gap: 4px;

      ${belowSm} {
        max-width: none;
      }
    `,
    description: css`
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      ${u.light} {
        color: ${theme.colors.gray[6]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[2]};
      }
    `,
    fields: css`
      flex: 999 1 420px;
      min-width: 0;
      max-width: ${FORM_FIELDS_MAX_WIDTH}px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    `,
  }
})
