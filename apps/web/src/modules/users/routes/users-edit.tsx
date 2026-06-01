import {
  getUsersIdSuspenseQueryKey,
  getUsersSuspenseQueryKey,
  patchUsersId,
  useGetUsersIdSuspense,
} from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { UsersForm } from '../components/users-form'
import type { UpdateUserInput, UserFormValues } from '../types'
import { userEditFormValidate } from '../validation'
import { usersEditRoute } from '.'

export function UsersEdit() {
  const { id } = usersEditRoute.useParams()
  const navigate = usersEditRoute.useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetUsersIdSuspense(id)

  const { mutate: updateUser, isPending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      patchUsersId(id, data),
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({
        queryKey: getUsersSuspenseQueryKey(),
        exact: true,
      })
      queryClient.setQueryData(
        getUsersIdSuspenseQueryKey(updatedItem.id),
        updatedItem
      )
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
        onError: () => {
          notify({ status: 'danger', message: t('notifications.updateFailed') })
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
