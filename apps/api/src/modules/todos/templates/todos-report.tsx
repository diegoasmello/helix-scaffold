import { renderToBuffer } from '@react-pdf/renderer'
import { StyleSheet, Text } from '@react-pdf/renderer'

import type { todos } from '@/db/schema'
import { BaseDocument } from '@/lib/pdf/base-document'
import { PdfTable, type PdfColumn } from '@/lib/pdf/pdf-table'
import { pdfColors } from '@/lib/pdf/pdf-styles'

type TodoRow = typeof todos.$inferSelect

const styles = StyleSheet.create({
  summary: {
    marginBottom: 16,
    fontSize: 10,
    color: pdfColors.muted,
  },
  colTitle: {
    flex: 3,
  },
  colStatus: {
    flex: 1,
    textAlign: 'center',
  },
  colDate: {
    flex: 1,
    textAlign: 'right',
  },
})

const columns: PdfColumn<TodoRow>[] = [
  { header: 'Title', style: styles.colTitle, render: (item) => item.title },
  { header: 'Status', style: styles.colStatus, render: (item) => item.status },
  {
    header: 'Date',
    style: styles.colDate,
    render: (item) =>
      item.date.toLocaleDateString('en-US', { dateStyle: 'short' }),
  },
]

interface TodosReportDocumentProps {
  items: TodoRow[]
}

function TodosReportDocument(props: Readonly<TodosReportDocumentProps>) {
  const { items } = props

  return (
    <BaseDocument title="Todos Report">
      <Text style={styles.summary}>{items.length} todo(s)</Text>
      <PdfTable
        columns={columns}
        data={items}
        keyExtractor={(item) => item.id}
      />
    </BaseDocument>
  )
}

export async function renderTodosReport(items: TodoRow[]): Promise<Buffer> {
  return renderToBuffer(<TodosReportDocument items={items} />)
}
