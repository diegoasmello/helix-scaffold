import { notify } from '@helix/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildReportFilename, downloadReport } from './download-report'

export function useExportPdf(
  path: string,
  params: Record<string, string | undefined>,
  slug: string
) {
  const [isExporting, setIsExporting] = useState(false)
  const { t } = useTranslation('common')

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await downloadReport(path, params, buildReportFilename(slug))
      notify({ status: 'success', message: t('report.downloaded') })
    } catch {
      notify({ status: 'danger', message: t('report.failed') })
    } finally {
      setIsExporting(false)
    }
  }

  return { isExporting, handleExport }
}
