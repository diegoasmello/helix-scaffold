import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

import { pdfStyles } from './pdf-styles'

interface BaseDocumentProps {
  title: string
  children: ReactNode
}

export function BaseDocument(props: Readonly<BaseDocumentProps>) {
  const { title, children } = props

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Document>
      <Page style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.headerTitle}>{title}</Text>
          <Text style={pdfStyles.headerMeta}>{date}</Text>
        </View>
        <View style={pdfStyles.content}>{children}</View>
        <Text
          style={pdfStyles.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
