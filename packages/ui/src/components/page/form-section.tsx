import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { type ReactNode, useId } from 'react'

export interface PageSectionProps {
  /** The section's `h2`. */
  title: ReactNode
  /** Next to the title, dimmed — e.g. "3 files". */
  meta?: ReactNode
  children: ReactNode
}

/**
 * A titled block of a detail page (`PageView`), separated from the next one by
 * a full-width border. Inside an `aside`, it drops its own padding and border.
 */
export function PageSection(props: Readonly<PageSectionProps>) {
  const { title, meta, children } = props

  const { classes } = useSectionStyles()
  const titleId = useId()

  return (
    <section
      data-page-section
      aria-labelledby={titleId}
      className={classes.section}
    >
      <div className={classes.titleRow}>
        <h2 id={titleId} className={classes.title}>
          {title}
        </h2>
        {meta && <span className={classes.meta}>{meta}</span>}
      </div>
      {children}
    </section>
  )
}

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
 * screens. Separated from the next group by a full-width border.
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
  const bordered = css`
    padding: 28px var(--helix-page-px, 0px);
    ${u.light} {
      border-bottom: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border-bottom: 1px solid ${theme.colors.dark[5]};
    }
    ${belowSm} {
      padding-top: 20px;
      padding-bottom: 20px;
    }
    &:last-child {
      border-bottom: 0;
    }
    aside & {
      padding: 0;
      border: 0;
    }
  `

  return {
    section: css`
      ${bordered};
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing.sm};
    `,
    formSection: css`
      ${bordered};
      display: flex;
      flex-wrap: wrap;
      gap: 20px 48px;
    `,
    titleRow: css`
      display: flex;
      align-items: baseline;
      gap: ${theme.spacing.xs};
    `,
    title: css`
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    `,
    meta: css`
      font-size: 13px;
      ${u.light} {
        color: ${theme.colors.gray[6]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[2]};
      }
    `,
    intro: css`
      flex: 1 1 240px;
      max-width: 300px;
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
      max-width: 720px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    `,
  }
})
