import { renderToBuffer } from '@react-pdf/renderer'
import { StyleSheet, Text } from '@react-pdf/renderer'

import type { auditLogs } from '@/db/schema'
import { BaseDocument } from '@/lib/pdf/base-document'
import { pdfColors } from '@/lib/pdf/pdf-styles'
import { type PdfColumn, PdfTable } from '@/lib/pdf/pdf-table'

type AuditLogRow = typeof auditLogs.$inferSelect

const styles = StyleSheet.create({
  summary: {
    marginBottom: 16,
    fontSize: 10,
    color: pdfColors.muted,
  },
  colDate: {
    flex: 2,
  },
  colUser: {
    flex: 2,
  },
  colAction: {
    flex: 1,
    textAlign: 'center',
  },
  colResource: {
    flex: 2,
  },
  colResourceId: {
    flex: 2,
  },
})

const columns: PdfColumn<AuditLogRow>[] = [
  {
    header: 'Date',
    style: styles.colDate,
    render: (item) =>
      `${item.createdAt.toLocaleDateString('en-US', { dateStyle: 'short' })} ${item.createdAt.toLocaleTimeString('en-US', { timeStyle: 'short' })}`,
  },
  { header: 'User', style: styles.colUser, render: (item) => item.userName },
  {
    header: 'Action',
    style: styles.colAction,
    render: (item) => item.action,
  },
  {
    header: 'Resource',
    style: styles.colResource,
    render: (item) => item.resource,
  },
  {
    header: 'Resource ID',
    style: styles.colResourceId,
    render: (item) => item.resourceId ?? '—',
  },
]

interface AuditReportDocumentProps {
  items: AuditLogRow[]
}

function AuditReportDocument(props: Readonly<AuditReportDocumentProps>) {
  const { items } = props

  return (
    <BaseDocument title="Audit Log Report">
      <Text style={styles.summary}>{items.length} log entry(s)</Text>
      <PdfTable
        columns={columns}
        data={items}
        keyExtractor={(item) => item.id}
      />
    </BaseDocument>
  )
}

export async function renderAuditReport(items: AuditLogRow[]): Promise<Buffer> {
  return renderToBuffer(<AuditReportDocument items={items} />)
}
