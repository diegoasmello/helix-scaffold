import {
  putUsersIdPassword,
  useGetUsersIdSuspense,
} from '@helix/api-client/hooks'
import {
  Button,
  Form,
  FormColumn,
  notify,
  PageEdit,
  PasswordInput,
  useForm,
} from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'

import type { SetUserPasswordInput, UserPasswordFormValues } from '../types'
import { userPasswordFormValidate } from '../validation'
import { usersPasswordRoute } from '.'

/** Sets another user's password — admin only (`users:password`). */
export function UsersPassword() {
  const { id } = usersPasswordRoute.useParams()
  const navigate = usersPasswordRoute.useNavigate()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetUsersIdSuspense(id)

  const { mutate: setPassword, isPending } = useMutation({
    mutationFn: (data: SetUserPasswordInput) => putUsersIdPassword(id, data),
  })

  const form = useForm<UserPasswordFormValues>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: userPasswordFormValidate,
  })

  const backToDetail = () => navigate({ to: '/users/$id', params: { id } })

  const handleSubmit = (values: UserPasswordFormValues) => {
    setPassword(
      { newPassword: values.newPassword },
      {
        onSuccess: () => {
          notify({
            status: 'success',
            message: t('notifications.passwordChanged', { name: item.name }),
          })
          backToDetail()
        },
        onError: (error) => {
          notify({
            status: 'danger',
            message: apiErrorMessage(
              error,
              'users',
              'notifications.passwordChangeFailed'
            ),
          })
        },
      }
    )
  }

  return (
    <Form<UserPasswordFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title={t('password.title')}
        description={t('password.description', {
          name: item.name,
          email: item.email,
        })}
        footerActions={
          <>
            <Button
              size="md"
              variant="default"
              disabled={isPending}
              onClick={backToDetail}
            >
              {tc('actions.cancel')}
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              {t('password.submit')}
            </Button>
          </>
        }
      >
        <FormColumn>
          <PasswordInput
            label={t('password.newPassword.label')}
            placeholder={t('password.newPassword.placeholder')}
            autoComplete="new-password"
            required
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            label={t('password.confirmPassword.label')}
            placeholder={t('password.confirmPassword.placeholder')}
            autoComplete="new-password"
            required
            {...form.getInputProps('confirmPassword')}
          />
        </FormColumn>
      </PageEdit>
    </Form>
  )
}
