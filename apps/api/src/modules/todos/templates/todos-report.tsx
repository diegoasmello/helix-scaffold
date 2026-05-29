import { renderToBuffer } from '@react-pdf/renderer'
import { StyleSheet, Text, View } from '@react-pdf/renderer'

import type { todos } from '@/db/schema'
import { BaseDocument } from '@/lib/pdf/base-document'
import { pdfColors } from '@/lib/pdf/pdf-styles'

type TodoRow = typeof todos.$inferSelect

interface TodosReportDocumentProps {
  items: TodoRow[]
}

const styles = StyleSheet.create({
  summary: {
    marginBottom: 16,
    fontSize: 10,
    color: pdfColors.muted,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: pdfColors.background,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
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
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: pdfColors.muted,
  },
  cellText: {
    fontSize: 9,
  },
})

function TodosReportDocument(props: Readonly<TodosReportDocumentProps>) {
  const { items } = props

  return (
    <BaseDocument title="Todos Report">
      <Text style={styles.summary}>{items.length} todo(s)</Text>
      <View>
        <View style={styles.tableHeader}>
          <Text style={[styles.colTitle, styles.headerText]}>Title</Text>
          <Text style={[styles.colStatus, styles.headerText]}>Status</Text>
          <Text style={[styles.colDate, styles.headerText]}>Date</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.colTitle, styles.cellText]}>{item.title}</Text>
            <Text style={[styles.colStatus, styles.cellText]}>
              {item.status}
            </Text>
            <Text style={[styles.colDate, styles.cellText]}>
              {item.date.toLocaleDateString('en-US', { dateStyle: 'short' })}
            </Text>
          </View>
        ))}
      </View>
    </BaseDocument>
  )
}

export async function renderTodosReport(items: TodoRow[]): Promise<Buffer> {
  return renderToBuffer(<TodosReportDocument items={items} />)
}
