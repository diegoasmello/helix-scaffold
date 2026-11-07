import {
  Button,
  Group,
  PasswordInput,
  Stack,
  TextInput,
  useForm,
} from '@helix/ui'
import { useTranslation } from 'react-i18next'

import type { EmailChangeFormValues, UpdateMeEmailInput } from '../types'
import { createEmailChangeFormValidate } from '../validation'

interface EmailChangeFormProps {
  currentEmail: string
  /** The account has a password: the API asks for it to change the email. */
  hasPassword: boolean
  loading: boolean
  /** "Request change" when a link confirms it, "Change email" when it is at once. */
  submitLabel: string
  onSubmit: (data: UpdateMeEmailInput) => void
}

/**
 * Mounted once the accounts are known, so its validation knows whether the
 * current password is required.
 */
export function EmailChangeForm(props: Readonly<EmailChangeFormProps>) {
  const { currentEmail, hasPassword, loading, submitLabel, onSubmit } = props

  const { t } = useTranslation('me')

  const form = useForm<EmailChangeFormValues>({
    initialValues: { newEmail: '', currentPassword: '' },
    validate: createEmailChangeFormValidate(currentEmail, hasPassword),
  })

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        onSubmit(
          hasPassword
            ? {
                newEmail: values.newEmail,
                currentPassword: values.currentPassword,
              }
            : { newEmail: values.newEmail }
        )
      )}
    >
      <Stack gap="md">
        <TextInput
          label={t('account.email.newLabel')}
          type="email"
          required
          {...form.getInputProps('newEmail')}
        />
        {hasPassword && (
          <PasswordInput
            label={t('account.email.currentPasswordLabel')}
            description={t('account.email.currentPasswordDescription')}
            required
            {...form.getInputProps('currentPassword')}
          />
        )}
        <Group justify="flex-end">
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
