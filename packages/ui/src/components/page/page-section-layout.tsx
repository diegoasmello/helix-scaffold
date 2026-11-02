import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useFormSummary } from '../form/form-summary'
import { PageHeader } from './page-header'

export interface PageSectionLayoutProps {
  title: ReactNode
  /** Under the title — e.g. dates on a detail, a hint on a form. */
  description?: ReactNode
  /** Next to the title — e.g. the record's `StatusBadge`. */
  titleAside?: ReactNode
  /** Header buttons (detail pages: Edit, Delete). Fill the width on phones. */
  actions?: ReactNode
  /** Sub-page navigation (`PageTabs`) at the bottom of the header. */
  tabs?: ReactNode
  /** The bar pinned to the bottom of the screen (forms: Cancel, Save). */
  footerActions?: ReactNode
  children: ReactNode
  /**
   * `form` (create/edit) draws a border under the header and lets
   * `FormSection`s run edge to edge. `view` (detail) keeps the header and the
   * content together, with no line between them (unless there are `tabs`).
   */
  variant?: 'form' | 'view'
}

/**
 * Shared body of `PageCreate`, `PageEdit` and `PageView`: a header without
 * breadcrumb, the content and `footerActions` stuck to the bottom of the
 * screen. In forms the header and each `FormSection` are separated by
 * full-width borders. Inside a `Form`, it shows the "fix N fields" alert after
 * a failed submit and "Unsaved changes" next to the footer buttons.
 */
export function PageSectionLayout(props: Readonly<PageSectionLayoutProps>) {
  const {
    title,
    description,
    titleAside,
    actions,
    tabs,
    footerActions,
    children,
    variant = 'form',
  } = props

  const { classes, cx } = useStyles()
  const { t } = useTranslation('ui')
  const formSummary = useFormSummary()

  const errorCount = formSummary?.errorCount ?? 0

  return (
    <div className={classes.root}>
      <div
        className={cx(
          classes.header,
          (variant === 'form' || tabs) && classes.headerDivider,
          tabs && classes.headerWithTabs
        )}
      >
        <PageHeader
          title={title}
          description={description}
          titleAside={titleAside}
          actions={actions}
          withBreadcrumb={false}
          fullWidthActionsOnMobile
        />
        {tabs}
      </div>

      <div
        className={cx(
          classes.content,
          variant === 'view' && !tabs && classes.contentUnderHeader
        )}
      >
        {errorCount > 0 && (
          <div role="alert" className={classes.errorAlert}>
            <strong>{t('form.saveFailed')}</strong>{' '}
            {t('form.fixFields', { count: errorCount })}
          </div>
        )}
        {children}
      </div>

      {footerActions && (
        <div className={classes.footer}>
          {formSummary?.dirty && (
            <span className={classes.unsaved}>
              <span aria-hidden className={classes.unsavedDot} />
              {t('form.unsavedChanges')}
            </span>
          )}
          <div className={classes.footerActions}>{footerActions}</div>
        </div>
      )}
    </div>
  )
}

const PX = 'var(--helix-page-px, 0px)'
const PT = 'var(--helix-page-pt, 0px)'
const PB = 'var(--helix-page-pb, 0px)'

const useStyles = createStyles((theme, _, u) => {
  const belowSm = `@media (max-width: calc(${theme.breakpoints.sm} - 0.0625em))`

  return {
    // Cancels the Layout's gutters: borders run edge to edge.
    root: css`
      flex: 1;
      display: flex;
      flex-direction: column;
      margin: calc(-1 * ${PT}) calc(-1 * ${PX}) calc(-1 * ${PB});
    `,
    header: css`
      padding: ${PT} ${PX} ${theme.spacing.lg};
    `,
    headerDivider: css`
      ${u.light} {
        border-bottom: 1px solid ${theme.colors.gray[3]};
      }
      ${u.dark} {
        border-bottom: 1px solid ${theme.colors.dark[5]};
      }
    `,
    headerWithTabs: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing.md};
      padding-bottom: 0;
    `,
    // Plain children (no sections) keep the page gutters.
    content: css`
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 28px ${PX};

      &:has(> [data-page-section]) {
        padding: 0;
      }
      ${belowSm} {
        padding-top: 20px;
        padding-bottom: 20px;
      }
    `,
    // A detail's content follows its header with no extra gap.
    contentUnderHeader: css`
      padding-top: 0;
      ${belowSm} {
        padding-top: 0;
      }
    `,
    errorAlert: css`
      margin: ${theme.spacing.lg} ${PX} 0;
      padding: ${theme.spacing.sm} 14px;
      border-radius: ${theme.radius.md};
      font-size: 14px;
      line-height: 1.45;
      ${u.light} {
        border: 1px solid #fecdca;
        background-color: #fef3f2;
        color: #912018;
      }
      ${u.dark} {
        border: 1px solid rgba(240, 68, 56, 0.35);
        background-color: rgba(240, 68, 56, 0.1);
        color: #fda29b;
      }

      strong {
        font-weight: 600;
      }

      /* Plain content (no sections) already has the page padding. */
      :not(:has(> [data-page-section])) > & {
        margin: 0 0 ${theme.spacing.lg};
      }
    `,
    footer: css`
      position: sticky;
      bottom: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: ${theme.spacing.sm};
      padding: ${theme.spacing.md} ${PX};
      ${u.light} {
        background-color: ${theme.white};
        border-top: 1px solid ${theme.colors.gray[3]};
      }
      ${u.dark} {
        background-color: ${theme.colors.dark[7]};
        border-top: 1px solid ${theme.colors.dark[5]};
      }

      ${belowSm} {
        padding: ${theme.spacing.sm} ${PX} ${theme.spacing.md};
      }
    `,
    unsaved: css`
      margin-right: auto;
      display: inline-flex;
      align-items: center;
      gap: ${theme.spacing.xs};
      font-size: 13.5px;
      ${u.light} {
        color: ${theme.colors.gray[7]};
      }
      ${u.dark} {
        color: ${theme.colors.dark[1]};
      }

      ${belowSm} {
        width: 100%;
      }
    `,
    unsavedDot: css`
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background-color: #f79009;
    `,
    footerActions: css`
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;

      ${belowSm} {
        width: 100%;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);

        & > .mantine-Button-root {
          height: 48px;
        }
      }
    `,
  }
})
