import type { DataTableProps } from 'mantine-datatable'
import { DataTable as MantineDataTable } from 'mantine-datatable'
export type { DataTableColumn } from 'mantine-datatable'
export type { DataTableProps } from 'mantine-datatable'
import { css } from '@emotion/react'
import { useMantineTheme } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { useMediaQuery } from '@mantine/hooks'
import type { Key } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableCards } from './data-table-cards'
import { DataTablePager } from './data-table-pager'

/** mantine-datatable does not export the type of `renderPagination`'s argument. */
type PaginationRenderContext = Parameters<
  NonNullable<
    Extract<
      DataTableProps<unknown>,
      { renderPagination?: unknown }
    >['renderPagination']
  >
>[0]

/**
 * The list table: sits directly on the page (no card) inside a rounded
 * border, with a header band, rows divided by borders and the pagination
 * underneath, outside the border.
 * Below the `sm` breakpoint it renders one card per record instead (see
 * `DataTableCards`); tables built from column `groups` always stay tables.
 */
export type HelixDataTableProps<T> = Omit<
  DataTableProps<T>,
  'withTableBorder'
> & {
  /**
   * Accessor of the column shown next to the title in the phone card (e.g.
   * the status badge), without its label.
   */
  cardTitleAside?: string
}

export function DataTable<T>(props: Readonly<HelixDataTableProps<T>>) {
  const {
    cardTitleAside,
    verticalSpacing = 'md',
    withColumnBorders = false,
    highlightOnHover = true,
    minHeight: minHeightProp,
    ...rest
  } = props

  const { classes } = useStyles()
  const { t } = useTranslation('ui')
  const theme = useMantineTheme()
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, true, {
    getInitialValueInEffect: false,
  })

  const noRecordsText = rest.noRecordsText ?? t('dataTable.noRecords')
  const empty = (rest.records ?? []).length === 0
  // A custom empty state (e.g. FilteredEmptyState) needs room for its buttons.
  const minHeight = minHeightProp ?? (empty && rest.emptyState ? 340 : 180)

  if (!wide && rest.columns) {
    return (
      <DataTableCards
        records={rest.records ?? []}
        columns={rest.columns}
        idAccessor={
          rest.idAccessor as string | ((record: T) => Key) | undefined
        }
        titleAside={cardTitleAside}
        page={rest.page}
        totalRecords={rest.totalRecords}
        recordsPerPage={rest.recordsPerPage}
        onPageChange={rest.onPageChange}
        noRecordsText={noRecordsText}
        emptyState={rest.emptyState}
        fetching={rest.fetching}
      />
    )
  }

  const tableProps = {
    renderPagination: ({ state, actions }: PaginationRenderContext) => (
      <DataTablePager
        page={state.page}
        totalPages={state.totalPages}
        totalRecords={state.totalRecords ?? 0}
        from={state.from ?? 0}
        to={state.to ?? 0}
        onPageChange={actions.setPage}
        recordsPerPage={state.recordsPerPage}
        recordsPerPageOptions={rest.recordsPerPageOptions}
        onRecordsPerPageChange={actions.setRecordsPerPage}
      />
    ),
    noRecordsText,
    withTableBorder: false,
    withRowBorders: true,
    borderRadius: 0,
    verticalSpacing,
    withColumnBorders,
    highlightOnHover,
    minHeight,
    ...rest,
  } as DataTableProps<T>

  return <MantineDataTable {...tableProps} className={classes.dataTable} />
}

const useStyles = createStyles((theme, _, u) => ({
  dataTable: css`
    ${u.light} {
      --mantine-datatable-border-color: ${theme.colors.gray[2]};
      --mantine-datatable-row-border-color: ${theme.colors.gray[2]};
    }
    ${u.dark} {
      --mantine-datatable-border-color: ${theme.colors.dark[5]};
      --mantine-datatable-row-border-color: ${theme.colors.dark[6]};
    }

    /* The border wraps the table only — the pager sits below it. */
    .mantine-datatable-scroll-area {
      border-radius: ${theme.radius.lg};
      overflow: hidden;
      ${u.light} {
        border: 1px solid ${theme.colors.gray[3]};
      }
      ${u.dark} {
        border: 1px solid ${theme.colors.dark[5]};
      }
    }

    .mantine-datatable-empty-state {
      padding-top: 72px;
    }
    /* Clickable once shown (mantine-datatable sets pointer-events: none). */
    .mantine-datatable-empty-state[data-active] {
      pointer-events: auto;
    }

    .mantine-datatable-header {
      th {
        height: 42px;
        padding-top: 0;
        padding-bottom: 0;
        font-size: 13px;
        font-weight: 500;
        ${u.light} {
          color: ${theme.colors.gray[6]};
          background-color: ${theme.colors.gray[0]};
          border-bottom: 1px solid ${theme.colors.gray[3]};
        }
        ${u.dark} {
          color: ${theme.colors.dark[2]};
          background-color: ${theme.colors.dark[8]};
          border-bottom: 1px solid ${theme.colors.dark[5]};
        }
      }

      th.mantine-datatable-header-cell-sortable:hover:not(:has(button:hover)) {
        ${u.light} {
          background-color: ${theme.colors.gray[1]};
        }
        ${u.dark} {
          background-color: ${theme.colors.dark[6]};
        }
      }
    }

    .mantine-datatable-row td {
      height: 58px;
      padding-top: 0;
      padding-bottom: 0;
    }

    .mantine-datatable-pagination {
      display: block;
      padding: 0;
      border: 0;
      background: transparent;
    }
  `,
}))
