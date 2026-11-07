import { Button, Group, Modal, Stack, Text } from '@helix/ui'
import { useTranslation } from 'react-i18next'

export interface ContactAdminModalProps {
  opened: boolean
  onClose: () => void
  title: string
  message: string
}

/**
 * What a screen shows in place of a flow that needs email when the API sends
 * none (`GET /registration/status` → `email: false`): the password reset and
 * the self-service email change. Only an administrator can do it.
 */
export function ContactAdminModal(props: Readonly<ContactAdminModalProps>) {
  const { opened, onClose, title, message } = props

  const { t } = useTranslation('common')

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        <Group justify="flex-end">
          <Button onClick={onClose}>{t('actions.close')}</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
