import { ApiError } from '@helix/api-client'
import {
  Button,
  Center,
  Code,
  createStyles,
  css,
  DocumentTitle,
  Group,
  Stack,
  Text,
  Title,
} from '@helix/ui'
import { Navigate, useRouter } from '@tanstack/react-router'
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

  // A request the API refused (403) is not a crash: a page asked for data its
  // guard did not cover. Show what the guard would have shown.
  // `feature_not_in_plan` goes to /403 on purpose: its body does not name the
  // feature, and /upgrade without one sends a subscribed user back to `/`.
  if (error instanceof ApiError && error.status === 403) {
    return (
      <Navigate
        to={error.code === 'subscription_required' ? '/upgrade' : '/403'}
        replace
      />
    )
  }

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={500}>
        <Text fz={80} fw={900} lh={1} c="dimmed">
          {t('boundary.code')}
        </Text>
        <DocumentTitle title={t('boundary.title')} />
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
