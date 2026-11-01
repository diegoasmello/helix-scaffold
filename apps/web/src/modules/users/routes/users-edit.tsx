import { patchUsersId, useGetUsersIdSuspense } from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'

import { UsersForm } from '../components/users-form'
import type { UpdateUserInput, UserFormValues } from '../types'
import { userEditFormValidate } from '../validation'
import { usersEditRoute } from '.'

export function UsersEdit() {
  const { id } = usersEditRoute.useParams()
  const navigate = usersEditRoute.useNavigate()
  const resourceCache = useResourceCache()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetUsersIdSuspense(id)

  const { mutate: updateUser, isPending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      patchUsersId(id, data),
    onSuccess: (updatedItem) => {
      void resourceCache.saved('users', updatedItem)
    },
  })

  const form = useForm<UserFormValues>({
    initialValues: {
      name: item.name,
      email: item.email,
      roleId: item.roleId,
      password: '',
    },
    validate: userEditFormValidate,
  })

  const handleSubmit = (values: UserFormValues) => {
    updateUser(
      {
        id,
        data: {
          name: values.name,
          email: values.email,
          roleId: values.roleId,
        },
      },
      {
        onSuccess: () => {
          notify({ status: 'success', message: t('notifications.updated') })
          navigate({ to: '/users' })
        },
        onError: (error) => {
          notify({
            status: 'danger',
            message: apiErrorMessage(
              error,
              'users',
              'notifications.updateFailed'
            ),
          })
        },
      }
    )
  }

  return (
    <Form<UserFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title={t('edit.title')}
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
        <UsersForm form={form} isEditing />
      </PageEdit>
    </Form>
  )
}
