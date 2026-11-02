import { css } from '@emotion/react'
import { Button, Select, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { Trans, useTranslation } from 'react-i18next'

export interface DataTablePagerProps {
  page: number
  totalPages: number
  totalRecords: number
  /** First and last record shown (1-based). */
  from: number
  to: number
  onPageChange: (page: number) => void
  recordsPerPage?: number
  recordsPerPageOptions?: number[]
  onRecordsPerPageChange?: (n: number) => void
  /** Phones: Previous · "Page x of y" · Next in three equal columns. */
  compact?: boolean
}

/**
 * The list's pagination: "Showing 1–8 of 31" on the left; rows per page,
 * "Page 1 of 4" and Previous/Next on the right.
 */
export function DataTablePager(props: Readonly<DataTablePagerProps>) {
  const {
    page,
    totalPages,
    totalRecords,
    from,
    to,
    onPageChange,
    recordsPerPage,
    recordsPerPageOptions,
    onRecordsPerPageChange,
    compact = false,
  } = props

  const { t } = useTranslation('ui')
  const { classes } = useStyles()

  if (totalRecords === 0) return null

  const pageOf = t('dataTable.pageOf', { page, pages: totalPages })
  const previous = (
    <Button
      variant="default"
      size={compact ? 'md' : 'sm'}
      disabled={page <= 1}
      onClick={() => onPageChange(page - 1)}
    >
      {t('dataTable.previous')}
    </Button>
  )
  const next = (
    <Button
      variant="default"
      size={compact ? 'md' : 'sm'}
      disabled={page >= totalPages}
      onClick={() => onPageChange(page + 1)}
    >
      {t('dataTable.next')}
    </Button>
  )

  if (compact) {
    if (totalPages <= 1) return null
    return (
      <nav
        aria-label={t('dataTable.paginationLabel')}
        className={classes.compact}
      >
        {previous}
        <Text size="sm" c="dimmed" ta="center">
          {pageOf}
        </Text>
        {next}
      </nav>
    )
  }

  return (
    <nav aria-label={t('dataTable.paginationLabel')} className={classes.pager}>
      <Text size="sm" className={classes.muted}>
        <Trans
          t={t}
          i18nKey="dataTable.pagination"
          values={{ from, to, total: totalRecords }}
          components={{ b: <strong className={classes.strong} /> }}
        />
      </Text>
      <div className={classes.right}>
        {onRecordsPerPageChange && recordsPerPageOptions && recordsPerPage && (
          <label className={classes.perPage}>
            <span className={classes.muted}>
              {t('dataTable.recordsPerPage')}
            </span>
            <Select
              size="sm"
              w={76}
              aria-label={t('dataTable.recordsPerPage')}
              data={recordsPerPageOptions.map(String)}
              value={String(recordsPerPage)}
              onChange={(n) => n && onRecordsPerPageChange(Number(n))}
              allowDeselect={false}
            />
          </label>
        )}
        <Text size="sm" className={classes.muted}>
          {pageOf}
        </Text>
        <div className={classes.buttons}>
          {previous}
          {next}
        </div>
      </div>
    </nav>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  pager: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing.sm};
    padding-top: ${theme.spacing.md};
    font-size: 13.5px;
  `,
  right: css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 18px;
  `,
  perPage: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.xs};
    font-size: 13.5px;
  `,
  buttons: css`
    display: flex;
    gap: 6px;
  `,
  muted: css`
    font-size: 13.5px;
    ${u.light} {
      color: ${theme.colors.gray[7]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[1]};
    }
  `,
  strong: css`
    font-weight: 600;
    ${u.light} {
      color: ${theme.colors.gray[9]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[0]};
    }
  `,
  compact: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: ${theme.spacing.xs};
    padding-top: ${theme.spacing.md};
  `,
}))
