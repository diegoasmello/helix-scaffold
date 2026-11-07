import {
  getMeSuspenseQueryKey,
  patchMe,
  patchMeEmail,
  useGetMeSuspense,
} from '@helix/api-client/hooks'
import {
  Alert,
  Button,
  Center,
  FormSection,
  Group,
  Loader,
  notify,
  Stack,
  TextInput,
  useDisclosure,
  useForm,
} from '@helix/ui'
import { IconInfoCircle } from '@helix/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { ContactAdminModal } from '@/modules/auth/components/contact-admin-modal'
import { useEmailEnabled } from '@/modules/auth/use-registration-open'

import { EmailChangeForm } from '../components/email-change-form'
import { linkedAccountsQuery } from '../linked-accounts'
import type { MeFormValues, UpdateMeEmailInput, UpdateMeInput } from '../types'
import { meFormValidate } from '../validation'

/**
 * How this account changes its email: confirmed by a link sent to the new
 * address (`link`), at once with the current password — the admin, when the
 * API sends no email (`direct`) — or not here at all: an administrator does it
 * (`admin`).
 */
type EmailChangeMode = 'link' | 'direct' | 'admin'

function emailChangeModeOf(
  emailEnabled: boolean,
  isAdmin: boolean
): EmailChangeMode {
  if (emailEnabled) return 'link'
  return isAdmin ? 'direct' : 'admin'
}

export function MeAccount() {
  const { data: profile } = useGetMeSuspense()
  const queryClient = useQueryClient()
  const { t } = useTranslation('me')
  const { t: tc } = useTranslation('common')
  const emailEnabled = useEmailEnabled()
  const emailChangeMode = emailChangeModeOf(
    emailEnabled,
    profile.role?.isAdmin ?? false
  )
  const [emailChangePending, setEmailChangePending] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [contactOpened, { open: openContact, close: closeContact }] =
    useDisclosure(false)
  const { data: accounts = [], isPending: accountsLoading } =
    useQuery(linkedAccountsQuery)
  const hasPassword = accounts.some((a) => a.providerId === 'credential')

  const { mutate: updateProfile, isPending: isUpdating } = useMutation({
    mutationFn: (data: UpdateMeInput) => patchMe(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(getMeSuspenseQueryKey(), updated)
      notify({
        status: 'success',
        message: t('account.email.notifications.updated'),
      })
    },
    onError: () => {
      notify({
        status: 'danger',
        message: t('account.email.notifications.updateFailed'),
      })
    },
  })

  const { mutate: requestEmailChange, isPending: isRequestingEmail } =
    useMutation({
      mutationFn: (data: UpdateMeEmailInput) => patchMeEmail(data),
      onSuccess: async (result, variables) => {
        if (result.changed) {
          await queryClient.invalidateQueries({
            queryKey: getMeSuspenseQueryKey(),
          })
          notify({
            status: 'success',
            message: t('account.email.notifications.emailChanged'),
          })
          return
        }
        setPendingEmail(variables.newEmail)
        setEmailChangePending(true)
      },
      onError: (error) => {
        notify({
          status: 'danger',
          message: apiErrorMessage(
            error,
            'me',
            'account.email.notifications.emailFailed'
          ),
        })
      },
    })

  const nameForm = useForm<MeFormValues>({
    initialValues: { name: profile.name },
    validate: meFormValidate,
  })

  const emailSectionDescription = {
    link: t('account.email.sectionDescription'),
    direct: t('account.email.sectionDescriptionDirect'),
    admin: t('account.email.sectionDescriptionAdmin'),
  }[emailChangeMode]

  return (
    <>
      <FormSection
        title={t('account.name.sectionTitle')}
        description={t('account.name.sectionDescription')}
      >
        <form onSubmit={nameForm.onSubmit((values) => updateProfile(values))}>
          <Stack gap="md">
            <TextInput
              label={t('account.name.label')}
              required
              {...nameForm.getInputProps('name')}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={isUpdating}>
                {tc('actions.save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </FormSection>

      <FormSection
        title={t('account.email.sectionTitle')}
        description={emailSectionDescription}
      >
        <TextInput
          label={t('account.email.currentLabel')}
          value={profile.email}
          disabled
        />
        {emailChangeMode === 'admin' ? (
          <>
            <Group justify="flex-end">
              <Button variant="default" onClick={openContact}>
                {t('account.email.changeButton')}
              </Button>
            </Group>
            <ContactAdminModal
              opened={contactOpened}
              onClose={closeContact}
              title={t('account.email.contactAdminTitle')}
              message={t('account.email.contactAdminMessage')}
            />
          </>
        ) : emailChangePending ? (
          <Stack gap="xs">
            <Alert
              color="blue"
              icon={<IconInfoCircle size={16} />}
              title={t('account.email.alertTitle')}
            >
              {t('account.email.alertMessage', { email: pendingEmail })}
            </Alert>
            <Group justify="flex-end">
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setEmailChangePending(false)}
              >
                {t('account.email.changeDifferent')}
              </Button>
            </Group>
          </Stack>
        ) : accountsLoading ? (
          <Center>
            <Loader size="sm" />
          </Center>
        ) : (
          <EmailChangeForm
            // A new email remounts it: empty fields, validated against it
            key={profile.email}
            currentEmail={profile.email}
            hasPassword={hasPassword}
            loading={isRequestingEmail}
            submitLabel={
              emailChangeMode === 'direct'
                ? t('account.email.changeButton')
                : tc('actions.requestChange')
            }
            onSubmit={(data) => requestEmailChange(data)}
          />
        )}
      </FormSection>
    </>
  )
}
