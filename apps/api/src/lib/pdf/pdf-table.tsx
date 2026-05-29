import { StyleSheet, Text, View } from '@react-pdf/renderer'

// Style is not directly exported by @react-pdf/renderer — derive it from StyleSheet.create's parameter
type Style = Parameters<typeof StyleSheet.create>[0][string]

import { pdfColors } from './pdf-styles'

export interface PdfColumn<T> {
  header: string
  style?: Style
  render: (item: T) => string
}

interface PdfTableProps<T> {
  columns: PdfColumn<T>[]
  data: T[]
  keyExtractor: (item: T) => string
}

const styles = StyleSheet.create({
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
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: pdfColors.muted,
  },
  cellText: {
    fontSize: 9,
  },
})

export function PdfTable<T>(props: Readonly<PdfTableProps<T>>) {
  const { columns, data, keyExtractor } = props

  return (
    <View>
      <View style={styles.tableHeader}>
        {columns.map((col) => (
          <Text
            key={col.header}
            style={
              col.style ? [col.style, styles.headerText] : styles.headerText
            }
          >
            {col.header}
          </Text>
        ))}
      </View>
      {data.map((item) => (
        <View key={keyExtractor(item)} style={styles.tableRow}>
          {columns.map((col) => (
            <Text
              key={col.header}
              style={col.style ? [col.style, styles.cellText] : styles.cellText}
            >
              {col.render(item)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
