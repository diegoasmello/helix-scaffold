import { useGetAuditLogsIdSuspense } from '@helix/api-client/hooks'
import type { AuditLog } from '@helix/api-client/types'
import {
  Badge,
  createStyles,
  css,
  Grid,
  LabeledValue,
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
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.date')}>
            <Text size="md">
              {formatDate(parseISO(log.createdAt), 'short')}
            </Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.action')}>
            <Badge color={ACTION_COLORS[log.action]} variant="light">
              {log.action}
            </Badge>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.user')}>
            <Text size="md">{log.userName}</Text>
            <Text size="sm" c="dimmed">
              {log.userEmail}
            </Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.resource')}>
            <Text size="md">{log.resource}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.resourceId')}>
            <Text size="md">{log.resourceId ?? '—'}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.ip')}>
            <Text size="md">{log.ip ?? '—'}</Text>
          </LabeledValue>
        </Grid.Col>
        {log.userAgent && (
          <Grid.Col span={12}>
            <LabeledValue label={t('labels.userAgent')}>
              <Text size="md">{log.userAgent}</Text>
            </LabeledValue>
          </Grid.Col>
        )}
        {log.metadata != null && (
          <Grid.Col span={12}>
            <LabeledValue label={t('labels.metadata')}>
              <Text size="md" component="pre" className={classes.metadata}>
                {JSON.stringify(log.metadata, null, 2)}
              </Text>
            </LabeledValue>
          </Grid.Col>
        )}
      </Grid>
    </PageView>
  )
}

const useStyles = createStyles(() => ({
  // Long values (URLs, ids) must wrap instead of widening the page
  metadata: css`
    white-space: pre-wrap;
    word-break: break-all;
  `,
}))
