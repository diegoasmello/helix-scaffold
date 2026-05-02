import {
  getRolesIdSuspenseQueryKey,
  getRolesSuspenseQueryKey,
  patchRolesId,
  useGetRolesIdSuspense,
} from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { RolesForm } from '../components/roles-form'
import type { RoleFormValues, UpdateRoleInput } from '../types'
import { roleFormValidate } from '../validation'
import { rolesEditRoute } from '.'

export function RolesEdit() {
  const { id } = rolesEditRoute.useParams()
  const navigate = rolesEditRoute.useNavigate()
  const queryClient = useQueryClient()

  const { data: item } = useGetRolesIdSuspense(id)
  const { mutate: updateRole, isPending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleInput }) =>
      patchRolesId(id, data),
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({
        queryKey: getRolesSuspenseQueryKey(),
        exact: true,
      })
      queryClient.setQueryData(
        getRolesIdSuspenseQueryKey(updatedItem.id),
        updatedItem
      )
    },
  })

  const form = useForm<RoleFormValues>({
    initialValues: {
      name: item.name,
      description: item.description ?? '',
    },
    validate: roleFormValidate,
  })

  const handleSubmit = (values: RoleFormValues) => {
    updateRole(
      {
        id,
        data: { name: values.name, description: values.description },
      },
      {
        onSuccess: () => {
          notify({ status: 'success', message: 'Role updated successfully' })
          navigate({ to: '/roles' })
        },
        onError: () => {
          notify({ status: 'danger', message: 'Failed to update role' })
        },
      }
    )
  }

  return (
    <Form<RoleFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title="Edit Role"
        footerActions={
          <Group justify="flex-end">
            <Button
              size="lg"
              variant="light"
              disabled={isPending}
              onClick={() => navigate({ to: '/roles' })}
            >
              Cancel
            </Button>
            <Button size="lg" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        }
      >
        <RolesForm form={form} />
      </PageEdit>
    </Form>
  )
}
