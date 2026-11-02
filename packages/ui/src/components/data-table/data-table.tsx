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

/**
 * The list table: sits directly on the page (no card) — a header band with
 * borders above and below, rows divided by borders, pagination underneath.
 * Below the `sm` breakpoint it renders one card per record instead (see
 * `DataTableCards`); tables built from column `groups` always stay tables.
 */
export function DataTable<T>(
  props: Readonly<Omit<DataTableProps<T>, 'withTableBorder'>>
) {
  const {
    verticalSpacing = 'md',
    withColumnBorders = false,
    highlightOnHover = true,
    minHeight = 180,
    ...rest
  } = props

  const { classes } = useStyles()
  const { t } = useTranslation('ui')
  const theme = useMantineTheme()
  const wide = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, true, {
    getInitialValueInEffect: false,
  })

  const noRecordsText = rest.noRecordsText ?? t('dataTable.noRecords')

  if (!wide && rest.columns) {
    return (
      <DataTableCards
        records={rest.records ?? []}
        columns={rest.columns}
        idAccessor={
          rest.idAccessor as string | ((record: T) => Key) | undefined
        }
        page={rest.page}
        totalRecords={rest.totalRecords}
        recordsPerPage={rest.recordsPerPage}
        onPageChange={rest.onPageChange}
        noRecordsText={noRecordsText}
        fetching={rest.fetching}
      />
    )
  }

  const tableProps = {
    recordsPerPageLabel: t('dataTable.recordsPerPage'),
    paginationText: ({
      from,
      to,
      totalRecords,
    }: {
      from: number
      to: number
      totalRecords: number
    }) => t('dataTable.pagination', { from, to, total: totalRecords }),
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

    .mantine-datatable-empty-state {
      padding-top: 72px;
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
          border-top: 1px solid ${theme.colors.gray[3]};
          border-bottom: 1px solid ${theme.colors.gray[3]};
        }
        ${u.dark} {
          color: ${theme.colors.dark[2]};
          background-color: ${theme.colors.dark[8]};
          border-top: 1px solid ${theme.colors.dark[5]};
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
      padding: ${theme.spacing.md} 0 0;
      border: 0;
      background: transparent;
      font-size: 13.5px;
    }
  `,
}))
