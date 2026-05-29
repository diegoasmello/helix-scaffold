import { StyleSheet } from '@react-pdf/renderer'

export const pdfColors = {
  primary: '#1b59f8',
  text: '#1a1a1a',
  muted: '#6b7280',
  border: '#e5e7eb',
  background: '#f3f4f6',
} as const

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: pdfColors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: pdfColors.primary,
  },
  headerMeta: {
    fontSize: 9,
    color: pdfColors.muted,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: pdfColors.muted,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 8,
  },
})
