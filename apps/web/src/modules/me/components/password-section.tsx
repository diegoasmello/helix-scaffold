import { patchMePassword, postMeSetPassword } from '@helix/api-client/hooks'
import {
  Button,
  Center,
  FormSection,
  Grid,
  GridCol,
  Group,
  Loader,
  notify,
  PasswordInput,
  Stack,
  useForm,
} from '@helix/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { authClient } from '../../../lib/authentication'
import type {
  LinkedAccount,
  PasswordFormValues,
  SetPasswordFormValues,
  UpdateMePasswordInput,
} from '../types'
import { passwordFormValidate, setPasswordFormValidate } from '../validation'

const ME_ACCOUNTS_QUERY_KEY = ['me', 'accounts'] as const

export function PasswordSection() {
  const { t } = useTranslation('me')
  const queryClient = useQueryClient()

  const { data: accounts = [], isPending: accountsLoading } = useQuery({
    queryKey: ME_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts()
      if (error) throw error
      return (data ?? []) as LinkedAccount[]
    },
  })

  const hasPassword = accounts.some((a) => a.providerId === 'credential')

  const { mutate: changePassword, isPending: changingPassword } = useMutation({
    mutationFn: (data: UpdateMePasswordInput) => patchMePassword(data),
    onSuccess: () => {
      changeForm.reset()
      notify({
        status: 'success',
        message: t('security.notifications.changed'),
      })
    },
    onError: () => {
      notify({
        status: 'danger',
        message: t('security.notifications.incorrectCurrent'),
      })
    },
  })

  const changeForm = useForm<PasswordFormValues>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: passwordFormValidate,
  })

  const handleChangeSubmit = changeForm.onSubmit((values) => {
    changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
  })

  const { mutate: setPassword, isPending: settingPassword } = useMutation({
    mutationFn: (data: { newPassword: string }) => postMeSetPassword(data),
    onSuccess: () => {
      setForm.reset()
      notify({
        status: 'success',
        message: t('security.notifications.set'),
      })
      queryClient.invalidateQueries({ queryKey: ME_ACCOUNTS_QUERY_KEY })
    },
    onError: () => {
      notify({
        status: 'danger',
        message: t('security.notifications.setFailed'),
      })
    },
  })

  const setForm = useForm<SetPasswordFormValues>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: setPasswordFormValidate,
  })

  const handleSetSubmit = setForm.onSubmit((values) => {
    setPassword({ newPassword: values.newPassword })
  })

  return (
    <FormSection
      title={t('security.sectionTitle')}
      description={
        !accountsLoading && !hasPassword
          ? t('security.passwordNotSetDescription')
          : t('security.sectionDescription')
      }
    >
      {accountsLoading ? (
        <Center>
          <Loader size="sm" />
        </Center>
      ) : hasPassword ? (
        <form onSubmit={handleChangeSubmit}>
          <Stack gap="md">
            <Grid>
              <GridCol span={{ base: 12, sm: 6 }}>
                <PasswordInput
                  label={t('security.currentPassword')}
                  required
                  {...changeForm.getInputProps('currentPassword')}
                />
              </GridCol>

              <GridCol span={{ base: 12, sm: 6 }}>
                <PasswordInput
                  label={t('security.newPassword')}
                  required
                  {...changeForm.getInputProps('newPassword')}
                />
              </GridCol>

              <GridCol span={12}>
                <PasswordInput
                  label={t('security.confirmNewPassword')}
                  required
                  {...changeForm.getInputProps('confirmPassword')}
                />
              </GridCol>
            </Grid>

            <Group justify="flex-end">
              <Button type="submit" loading={changingPassword}>
                {t('security.changeButton')}
              </Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <form onSubmit={handleSetSubmit}>
          <Stack gap="md">
            <PasswordInput
              label={t('security.newPassword')}
              placeholder={t('security.newPasswordPlaceholder')}
              required
              {...setForm.getInputProps('newPassword')}
            />
            <PasswordInput
              label={t('security.confirmNewPassword')}
              placeholder={t('security.confirmPasswordPlaceholder')}
              required
              {...setForm.getInputProps('confirmPassword')}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={settingPassword}>
                {t('security.setPasswordButton')}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </FormSection>
  )
}
