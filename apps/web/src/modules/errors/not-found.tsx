import {
  Button,
  Center,
  DocumentTitle,
  Group,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export function NotFound() {
  const router = useRouter()
  const { t } = useTranslation('errors')

  return (
    <Center h="100vh">
      <Stack align="center" gap="md">
        <Text fz={80} fw={900} lh={1} c="dimmed">
          {t('notFound.code')}
        </Text>
        <DocumentTitle title={t('notFound.title')} />
        <Title order={2}>{t('notFound.title')}</Title>
        <Text c="dimmed" ta="center" maw={400}>
          {t('notFound.description')}
        </Text>
        <Group mt="md">
          <Button variant="default" onClick={() => router.history.back()}>
            {t('notFound.goBack')}
          </Button>
          <Button onClick={() => router.navigate({ to: '/' })}>
            {t('notFound.goHome')}
          </Button>
        </Group>
      </Stack>
    </Center>
  )
}
