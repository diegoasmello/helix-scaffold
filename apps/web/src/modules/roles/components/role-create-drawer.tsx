import { getRolesAllSuspenseQueryKey, postRoles } from '@helix/api-client/hooks'
import { Button, Drawer, Group, notify, Stack, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { CreateRoleInput, RoleFormValues } from '../types'
import { roleFormValidate } from '../validation'
import { RolesForm } from './roles-form'

export interface RoleCreateDrawerProps {
  opened: boolean
  onClose: () => void
  onSuccess: (roleId: string) => void
}

export function RoleCreateDrawer(props: Readonly<RoleCreateDrawerProps>) {
  const { opened, onClose, onSuccess } = props

  const queryClient = useQueryClient()

  const { mutate: createRole, isPending } = useMutation({
    mutationFn: (data: CreateRoleInput) => postRoles(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRolesAllSuspenseQueryKey(),
      })
    },
  })

  const form = useForm<RoleFormValues>({
    initialValues: { name: '', description: '' },
    validate: roleFormValidate,
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  const handleSubmit = (values: RoleFormValues) => {
    createRole(
      { name: values.name, description: values.description },
      {
        onSuccess: (created) => {
          notify({ status: 'success', message: 'Role created successfully' })
          handleClose()
          onSuccess(created.id)
        },
        onError: () => {
          notify({ status: 'danger', message: 'Failed to create role' })
        },
      }
    )
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title="Create Role"
      position="right"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <RolesForm form={form} />
          <Group justify="flex-end">
            <Button
              size="md"
              variant="secondary"
              type="button"
              disabled={isPending}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  )
}
