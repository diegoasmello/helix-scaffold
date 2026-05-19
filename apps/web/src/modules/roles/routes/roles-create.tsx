import { getRolesSuspenseQueryKey, postRoles } from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { RolesForm } from '../components/roles-form'
import type { CreateRoleInput, RoleFormValues } from '../types'
import { roleFormValidate } from '../validation'
import { rolesCreateRoute } from '.'

export function RolesCreate() {
  const navigate = rolesCreateRoute.useNavigate()
  const queryClient = useQueryClient()

  const { mutate: createRole, isPending } = useMutation({
    mutationFn: (data: CreateRoleInput) => postRoles(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRolesSuspenseQueryKey(),
        exact: true,
      })
    },
  })

  const form = useForm<RoleFormValues>({
    initialValues: {
      name: '',
      description: '',
    },
    validate: roleFormValidate,
  })

  const handleSubmit = (values: RoleFormValues) => {
    createRole(
      { name: values.name, description: values.description },
      {
        onSuccess: () => {
          notify({ status: 'success', message: 'Role created successfully' })
          navigate({ to: '/roles' })
        },
        onError: () => {
          notify({ status: 'danger', message: 'Failed to create role' })
        },
      }
    )
  }

  return (
    <Form<RoleFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title="Create Role"
        footerActions={
          <Group justify="flex-end">
            <Button
              size="md"
              variant="secondary"
              disabled={isPending}
              onClick={() => navigate({ to: '/roles' })}
            >
              Cancel
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        }
      >
        <RolesForm form={form} />
      </PageCreate>
    </Form>
  )
}
