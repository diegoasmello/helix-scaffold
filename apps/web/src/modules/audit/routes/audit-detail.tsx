import { useGetAuditLogsIdSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import {
  Badge,
  createStyles,
  css,
  DetailList,
  PageSection,
  PageView,
  Text,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { auditDetailRoute } from '.'

const ACTION_COLORS: Record<AuditLog['action'], string> = {
  create: 'green',
  edit: 'blue',
  delete: 'red',
}

export function AuditDetail() {
  const { id } = auditDetailRoute.useParams()
  const { t } = useTranslation('audit')
  const { classes } = useStyles()

  const { data: log } = useGetAuditLogsIdSuspense(id)

  return (
    <PageView title={t('detail.title')}>
      <PageSection title={t('sections.event')}>
        <DetailList
          items={[
            {
              label: t('labels.date'),
              value: formatDate(parseISO(log.createdAt), 'short'),
            },
            {
              label: t('labels.action'),
              value: (
                <Badge color={ACTION_COLORS[log.action]} variant="light">
                  {log.action}
                </Badge>
              ),
            },
            {
              label: t('labels.user'),
              value: (
                <>
                  {log.userName}
                  {log.userEmail && (
                    <Text size="sm" c="dimmed" fw={400}>
                      {log.userEmail}
                    </Text>
                  )}
                </>
              ),
            },
            { label: t('labels.resource'), value: log.resource },
            { label: t('labels.resourceId'), value: log.resourceId },
            { label: t('labels.ip'), value: log.ip },
          ]}
        />
      </PageSection>
      {log.userAgent && (
        <PageSection title={t('labels.userAgent')}>
          <Text size="md" className={classes.wrap}>
            {log.userAgent}
          </Text>
        </PageSection>
      )}
      {log.metadata != null && (
        <PageSection title={t('labels.metadata')}>
          <Text size="md" component="pre" className={classes.metadata}>
            {JSON.stringify(log.metadata, null, 2)}
          </Text>
        </PageSection>
      )}
    </PageView>
  )
}

const useStyles = createStyles(() => ({
  // Long values (URLs, ids) must wrap instead of widening the page
  metadata: css`
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  `,
  wrap: css`
    overflow-wrap: anywhere;
  `,
}))
