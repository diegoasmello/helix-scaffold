import { postRoles } from '@helix/api-client/hooks'
import { Button, Drawer, Group, notify, Stack, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useResourceCache } from '@/lib/resource-cache'

import { isRoleNameTaken } from '../api-errors'
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

  const resourceCache = useResourceCache()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  const { mutate: createRole, isPending } = useMutation({
    mutationFn: (data: CreateRoleInput) => postRoles(data),
    onSuccess: () => {
      void resourceCache.changed('roles')
    },
  })

  const form = useForm<RoleFormValues>({
    initialValues: { name: '', description: '', isDefault: false },
    validate: roleFormValidate,
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  const handleSubmit = (values: RoleFormValues) => {
    createRole(
      {
        name: values.name,
        description: values.description,
        isDefault: values.isDefault,
      },
      {
        onSuccess: (created) => {
          notify({ status: 'success', message: t('notifications.created') })
          handleClose()
          onSuccess(created.id)
        },
        onError: (error) => {
          if (isRoleNameTaken(error)) {
            form.setFieldError('name', t('form.name.taken'))
            return
          }
          notify({ status: 'danger', message: t('notifications.createFailed') })
        },
      }
    )
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={t('create.drawerTitle')}
      position="right"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <RolesForm form={form} />
          <Group justify="flex-end">
            <Button
              size="md"
              variant="default"
              type="button"
              disabled={isPending}
              onClick={handleClose}
            >
              {tc('actions.cancel')}
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              {tc('actions.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  )
}
