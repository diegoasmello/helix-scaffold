import {
  getUsersIdSuspenseQueryKey,
  getUsersSuspenseQueryKey,
  patchUsersId,
  useGetUsersIdSuspense,
} from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { UsersForm } from '../components/users-form'
import type { UpdateUserInput, UserFormValues } from '../types'
import { userEditFormValidate } from '../validation'
import { usersEditRoute } from '.'

export function UsersEdit() {
  const { id } = usersEditRoute.useParams()
  const navigate = usersEditRoute.useNavigate()
  const queryClient = useQueryClient()

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
          notify({ status: 'success', message: 'User updated successfully' })
          navigate({ to: '/users' })
        },
        onError: () => {
          notify({ status: 'danger', message: 'Failed to update user' })
        },
      }
    )
  }

  return (
    <Form<UserFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title="Edit User"
        footerActions={
          <Group justify="flex-end">
            <Button
              size="md"
              variant="secondary"
              disabled={isPending}
              onClick={() => navigate({ to: '/users' })}
            >
              Cancel
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        }
      >
        <UsersForm form={form} isEditing />
      </PageEdit>
    </Form>
  )
}
