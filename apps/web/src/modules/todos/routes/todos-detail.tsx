import { useGetTodosIdSuspense } from '@helix/api-client/hooks'
import {
  Badge,
  Button,
  FilePreview,
  Grid,
  Group,
  LabeledValue,
  PageView,
  RichTextRenderer,
  SimpleGrid,
  Text,
} from '@helix/ui'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { formatDate } from '@/utils/date'

import { todoDetailRoute } from '.'

export function TodoDetail() {
  const { id } = todoDetailRoute.useParams()
  const navigate = todoDetailRoute.useNavigate()
  const { t } = useTranslation('todos')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetTodosIdSuspense(id)

  return (
    <PageView
      title={t('detail.title')}
      footerActions={
        <Group justify="flex-end">
          <Button
            size="md"
            variant="default"
            onClick={() => navigate({ to: '/todos' })}
          >
            {tc('actions.back')}
          </Button>
        </Group>
      }
    >
      <Grid>
        <Grid.Col span={12}>
          <LabeledValue label={t('labels.title')}>
            <Text size="md">{item.title}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={12}>
          <LabeledValue label={t('labels.description')}>
            <Text size="md">{item.description}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={12}>
          <LabeledValue label={t('labels.content')}>
            <RichTextRenderer value={item.content} />
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.date')}>
            <Text size="md">{formatDate(parseISO(item.date), 'short')}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.status')}>
            <Badge
              color={item.status === 'completed' ? 'green' : 'gray'}
              variant="light"
            >
              {item.status === 'completed'
                ? t('status.completed')
                : t('status.pending')}
            </Badge>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label={t('labels.createdAt')}>
            <Text size="md">
              {formatDate(parseISO(item.createdAt), 'short')}
            </Text>
          </LabeledValue>
        </Grid.Col>
        {item.file && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <LabeledValue label={t('labels.file')}>
              <FilePreview upload={item.file} />
            </LabeledValue>
          </Grid.Col>
        )}
        {item.image && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <LabeledValue label={t('labels.image')}>
              <FilePreview upload={item.image} />
            </LabeledValue>
          </Grid.Col>
        )}
        {item.attachments && item.attachments.length > 0 && (
          <Grid.Col span={12}>
            <LabeledValue label={t('labels.attachments')}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {item.attachments.map((attachment) => (
                  <FilePreview key={attachment.id} upload={attachment} />
                ))}
              </SimpleGrid>
            </LabeledValue>
          </Grid.Col>
        )}
      </Grid>
    </PageView>
  )
}
