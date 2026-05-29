import { renderToBuffer } from '@react-pdf/renderer'
import { StyleSheet, Text, View } from '@react-pdf/renderer'

import type { auditLogs } from '@/db/schema'
import { BaseDocument } from '@/lib/pdf/base-document'
import { pdfColors } from '@/lib/pdf/pdf-styles'

type AuditLogRow = typeof auditLogs.$inferSelect

interface AuditReportDocumentProps {
  items: AuditLogRow[]
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
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: pdfColors.muted,
  },
  cellText: {
    fontSize: 9,
  },
})

function AuditReportDocument(props: Readonly<AuditReportDocumentProps>) {
  const { items } = props

  return (
    <BaseDocument title="Audit Log Report">
      <Text style={styles.summary}>{items.length} log entry(s)</Text>
      <View>
        <View style={styles.tableHeader}>
          <Text style={[styles.colDate, styles.headerText]}>Date</Text>
          <Text style={[styles.colUser, styles.headerText]}>User</Text>
          <Text style={[styles.colAction, styles.headerText]}>Action</Text>
          <Text style={[styles.colResource, styles.headerText]}>Resource</Text>
          <Text style={[styles.colResourceId, styles.headerText]}>
            Resource ID
          </Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.colDate, styles.cellText]}>
              {item.createdAt.toLocaleDateString('en-US', {
                dateStyle: 'short',
              })}{' '}
              {item.createdAt.toLocaleTimeString('en-US', {
                timeStyle: 'short',
              })}
            </Text>
            <Text style={[styles.colUser, styles.cellText]}>
              {item.userName}
            </Text>
            <Text style={[styles.colAction, styles.cellText]}>
              {item.action}
            </Text>
            <Text style={[styles.colResource, styles.cellText]}>
              {item.resource}
            </Text>
            <Text style={[styles.colResourceId, styles.cellText]}>
              {item.resourceId ?? '—'}
            </Text>
          </View>
        ))}
      </View>
    </BaseDocument>
  )
}

export async function renderAuditReport(items: AuditLogRow[]): Promise<Buffer> {
  return renderToBuffer(<AuditReportDocument items={items} />)
}
