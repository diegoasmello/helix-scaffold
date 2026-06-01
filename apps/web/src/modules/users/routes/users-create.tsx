import { getUsersSuspenseQueryKey, postUsers } from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { UsersForm } from '../components/users-form'
import type { CreateUserInput, UserFormValues } from '../types'
import { userCreateFormValidate } from '../validation'
import { usersCreateRoute } from '.'

export function UsersCreate() {
  const queryClient = useQueryClient()
  const navigate = usersCreateRoute.useNavigate()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (data: CreateUserInput) => postUsers(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getUsersSuspenseQueryKey(),
        exact: true,
      })
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
        onError: () => {
          notify({ status: 'danger', message: t('notifications.createFailed') })
        },
      }
    )
  }

  return (
    <Form<UserFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title={t('create.title')}
        footerActions={
          <Group justify="flex-end">
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
          </Group>
        }
      >
        <UsersForm form={form} />
      </PageCreate>
    </Form>
  )
}
