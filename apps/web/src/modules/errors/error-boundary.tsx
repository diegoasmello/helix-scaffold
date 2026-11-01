import {
  Button,
  Center,
  Code,
  createStyles,
  css,
  Group,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

interface ErrorBoundaryProps {
  error: Error
  reset: () => void
}

export function ErrorBoundary(props: Readonly<ErrorBoundaryProps>) {
  const { error, reset } = props

  const router = useRouter()
  const { t } = useTranslation('errors')
  const { classes } = useStyles()

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={500}>
        <Text fz={80} fw={900} lh={1} c="dimmed">
          {t('boundary.code')}
        </Text>
        <Title order={2}>{t('boundary.title')}</Title>
        <Text c="dimmed" ta="center">
          {t('boundary.description')}
        </Text>
        {error.message && (
          <Code block w="100%" className={classes.message}>
            {error.message}
          </Code>
        )}
        <Group mt="md">
          <Button variant="default" onClick={() => router.history.back()}>
            {t('boundary.goBack')}
          </Button>
          <Button onClick={reset}>{t('boundary.tryAgain')}</Button>
        </Group>
      </Stack>
    </Center>
  )
}

const useStyles = createStyles(() => ({
  message: css`
    word-break: break-word;
  `,
}))
