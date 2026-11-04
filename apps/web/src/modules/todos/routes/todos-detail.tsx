import { deleteTodosId, useGetTodosIdSuspense } from '@helix/api-client/hooks'
import {
  Button,
  confirm,
  FilePreview,
  Grid,
  IconPencil,
  IconTrash,
  LabeledValue,
  notify,
  PageView,
  RichTextRenderer,
  SimpleGrid,
  StatusBadge,
  Text,
} from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { useResourceCache } from '@/lib/resource-cache'
import { formatDate } from '@/utils/date'

import { HasPermission } from '../../auth/components/has-permission'
import { todoDetailRoute } from '.'

export function TodoDetail() {
  const { id } = todoDetailRoute.useParams()
  const navigate = todoDetailRoute.useNavigate()
  const { t } = useTranslation('todos')
  const { t: tc } = useTranslation('common')
  const resourceCache = useResourceCache()

  const { data: item } = useGetTodosIdSuspense(id)

  const { mutate: deleteTodo } = useMutation({
    mutationFn: () => deleteTodosId(id),
    onSuccess: async () => {
      notify({ status: 'success', message: t('notifications.deleted') })
      // Leave the page before dropping its query, or it would refetch a 404.
      await navigate({ to: '/todos' })
      void resourceCache.removed('todos', id)
    },
    onError: () => {
      notify({ status: 'danger', message: t('notifications.deleteFailed') })
    },
  })

  const handleDelete = () => {
    confirm({
      status: 'danger',
      title: t('delete.title'),
      message: t('delete.message'),
      confirmLabel: tc('actions.delete'),
      onConfirm: () => deleteTodo(),
    })
  }

  const attachments = item.attachments ?? []

  return (
    <PageView
      title={item.title}
      titleAside={
        <StatusBadge tone={item.status === 'completed' ? 'success' : 'warning'}>
          {item.status === 'completed'
            ? t('status.completed')
            : t('status.pending')}
        </StatusBadge>
      }
      actions={
        <>
          <HasPermission resource="todos" action="delete">
            <Button
              variant="default"
              color="red"
              leftSection={<IconTrash size={17} />}
              onClick={handleDelete}
            >
              {tc('actions.delete')}
            </Button>
          </HasPermission>
          <HasPermission resource="todos" action="edit">
            <Button
              leftSection={<IconPencil size={17} />}
              onClick={() =>
                navigate({ to: '/todos/$id/edit', params: { id } })
              }
            >
              {tc('actions.edit')}
            </Button>
          </HasPermission>
        </>
      }
    >
      <Grid gap="lg">
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
        {attachments.length > 0 && (
          <Grid.Col span={12}>
            <LabeledValue label={t('labels.attachments')}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {attachments.map((attachment) => (
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
