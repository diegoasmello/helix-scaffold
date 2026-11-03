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

export function Forbidden() {
  const router = useRouter()
  const { t } = useTranslation('errors')

  return (
    <Center h="100%">
      <Stack align="center" gap="md">
        <Text fz={80} fw={900} lh={1} c="dimmed">
          {t('forbidden.code')}
        </Text>
        <DocumentTitle title={t('forbidden.title')} />
        <Title order={2}>{t('forbidden.title')}</Title>
        <Text c="dimmed" ta="center" maw={400}>
          {t('forbidden.description')}
        </Text>
        <Group mt="md">
          <Button variant="default" onClick={() => router.history.back()}>
            {t('forbidden.goBack')}
          </Button>
          <Button onClick={() => router.navigate({ to: '/' })}>
            {t('forbidden.goHome')}
          </Button>
        </Group>
      </Stack>
    </Center>
  )
}
