import { notify } from '@helix/ui'
import { useState } from 'react'

import { buildReportFilename, downloadReport } from './download-report'

export function useExportPdf(
  path: string,
  params: Record<string, string | undefined>,
  slug: string
) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await downloadReport(path, params, buildReportFilename(slug))
      notify({ status: 'success', message: 'Report downloaded successfully' })
    } catch {
      notify({ status: 'danger', message: 'Failed to generate report' })
    } finally {
      setIsExporting(false)
    }
  }

  return { isExporting, handleExport }
}
