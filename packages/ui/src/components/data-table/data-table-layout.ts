import { createContext, useContext } from 'react'

/**
 * How the surrounding `DataTable` is drawn: `table` from the `sm` breakpoint
 * up, `cards` below it. Cells read it to adapt (e.g. `RowActions` renders
 * full-width buttons in a card).
 */
export type DataTableLayout = 'table' | 'cards'

export const DataTableLayoutContext = createContext<DataTableLayout>('table')

export function useDataTableLayout(): DataTableLayout {
  return useContext(DataTableLayoutContext)
}
