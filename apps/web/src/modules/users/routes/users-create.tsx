import { postUsers } from '@helix/api-client/hooks'
import { Button, Form, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'

import { UsersForm } from '../components/users-form'
import type { CreateUserInput, UserFormValues } from '../types'
import { userCreateFormValidate } from '../validation'
import { usersCreateRoute } from '.'

export function UsersCreate() {
  const resourceCache = useResourceCache()
  const navigate = usersCreateRoute.useNavigate()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data: CreateUserInput) => postUsers(data),
    onSuccess: () => {
      void resourceCache.changed('users')
    },
  })

  const form = useForm<UserFormValues>({
    initialValues: {
      name: '',
      email: '',
      roleId: null,
      password: '',
    },
    validate: userCreateFormValidate,
  })

  const handleSubmit = (values: UserFormValues) => {
    createUser(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        ...(values.roleId ? { roleId: values.roleId } : {}),
      },
      {
        onSuccess: () => {
          notify({ status: 'success', message: t('notifications.created') })
          navigate({ to: '/users' })
        },
        onError: (error) => {
          notify({
            status: 'danger',
            message: apiErrorMessage(
              error,
              'users',
              'notifications.createFailed'
            ),
          })
        },
      }
    )
  }

  return (
    <Form<UserFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title={t('create.title')}
        footerActions={
          <>
            <Button
              size="md"
              variant="default"
              disabled={isPending}
              onClick={() => navigate({ to: '/users' })}
            >
              {tc('actions.cancel')}
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        <UsersForm form={form} />
      </PageCreate>
    </Form>
  )
}
