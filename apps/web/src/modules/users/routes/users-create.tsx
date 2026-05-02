import { getUsersSuspenseQueryKey, postUsers } from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { UsersForm } from '../components/users-form'
import type { CreateUserInput, UserFormValues } from '../types'
import { userCreateFormValidate } from '../validation'
import { usersCreateRoute } from '.'

export function UsersCreate() {
  const queryClient = useQueryClient()
  const navigate = usersCreateRoute.useNavigate()

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
          notify({ status: 'success', message: 'User created successfully' })
          navigate({ to: '/users' })
        },
        onError: () => {
          notify({ status: 'danger', message: 'Failed to create user' })
        },
      }
    )
  }

  return (
    <Form<UserFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title="Create User"
        footerActions={
          <Group justify="flex-end">
            <Button
              size="lg"
              variant="light"
              disabled={isPending}
              onClick={() => navigate({ to: '/users' })}
            >
              Cancel
            </Button>
            <Button size="lg" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        }
      >
        <UsersForm form={form} />
      </PageCreate>
    </Form>
  )
}
