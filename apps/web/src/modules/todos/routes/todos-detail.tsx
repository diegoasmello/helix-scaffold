import { deleteTodosId, useGetTodosIdSuspense } from '@helix/api-client/hooks'
import {
  Button,
  confirm,
  DetailList,
  FilePreview,
  IconPencil,
  IconTrash,
  notify,
  PageSection,
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
          <Button
            variant="default"
            color="red"
            leftSection={<IconTrash size={17} />}
            onClick={handleDelete}
          >
            {tc('actions.delete')}
          </Button>
          <Button
            leftSection={<IconPencil size={17} />}
            onClick={() => navigate({ to: '/todos/$id/edit', params: { id } })}
          >
            {tc('actions.edit')}
          </Button>
        </>
      }
      aside={
        <>
          <PageSection title={t('sections.details')}>
            <DetailList
              items={[
                {
                  label: t('labels.date'),
                  value: formatDate(parseISO(item.date), 'short'),
                },
                {
                  label: t('labels.createdAt'),
                  value: formatDate(parseISO(item.createdAt), 'short'),
                },
              ]}
            />
          </PageSection>
          {item.file && (
            <PageSection title={t('labels.file')}>
              <FilePreview upload={item.file} />
            </PageSection>
          )}
          {item.image && (
            <PageSection title={t('labels.image')}>
              <FilePreview upload={item.image} />
            </PageSection>
          )}
        </>
      }
    >
      <PageSection title={t('labels.description')}>
        <Text size="md">{item.description}</Text>
      </PageSection>
      <PageSection title={t('labels.content')}>
        <RichTextRenderer value={item.content} />
      </PageSection>
      {attachments.length > 0 && (
        <PageSection
          title={t('labels.attachments')}
          meta={t('detail.attachmentsCount', { count: attachments.length })}
        >
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            {attachments.map((attachment) => (
              <FilePreview key={attachment.id} upload={attachment} />
            ))}
          </SimpleGrid>
        </PageSection>
      )}
    </PageView>
  )
}
