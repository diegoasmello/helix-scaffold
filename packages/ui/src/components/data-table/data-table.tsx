import type { DataTableProps } from 'mantine-datatable'
import { DataTable as MantineDataTable } from 'mantine-datatable'
export type { DataTableColumn } from 'mantine-datatable'
export type { DataTableProps } from 'mantine-datatable'

export function DataTable<T>(
  props: Readonly<Omit<DataTableProps<T>, 'withTableBorder'>>
) {
  const {
    verticalSpacing = 'md',
    borderRadius = 'sm',
    withColumnBorders = true,
    highlightOnHover = true,
    ...rest
  } = props

  const tableProps = {
    withTableBorder: true,
    verticalSpacing,
    borderRadius,
    withColumnBorders,
    highlightOnHover,
    ...rest,
  } as DataTableProps<T>

  return <MantineDataTable {...tableProps} />
}
