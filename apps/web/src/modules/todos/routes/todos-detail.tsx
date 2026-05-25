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

import { formatDate } from '@/utils/date'

import { todoDetailRoute } from '.'

export function TodoDetail() {
  const { id } = todoDetailRoute.useParams()
  const navigate = todoDetailRoute.useNavigate()

  const { data: item } = useGetTodosIdSuspense(id)

  return (
    <PageView
      title="View Todo"
      footerActions={
        <Group justify="flex-end">
          <Button
            size="md"
            variant="secondary"
            onClick={() => navigate({ to: '/todos' })}
          >
            Back
          </Button>
        </Group>
      }
    >
      <Grid>
        <Grid.Col span={12}>
          <LabeledValue label="Title">
            <Text size="md">{item.title}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={12}>
          <LabeledValue label="Description">
            <Text size="md">{item.description}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={12}>
          <LabeledValue label="Content">
            <RichTextRenderer value={item.content} />
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Date">
            <Text size="md">{formatDate(parseISO(item.date), 'short')}</Text>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Status">
            <Badge
              color={item.status === 'completed' ? 'green' : 'gray'}
              variant="light"
            >
              {item.status === 'completed' ? 'Completed' : 'Pending'}
            </Badge>
          </LabeledValue>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <LabeledValue label="Created At">
            <Text size="md">
              {formatDate(parseISO(item.createdAt), 'short')}
            </Text>
          </LabeledValue>
        </Grid.Col>
        {item.attachments && item.attachments.length > 0 && (
          <Grid.Col span={12}>
            <LabeledValue label="Attachments">
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
