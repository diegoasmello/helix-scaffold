import { getRolesSuspenseQueryKey, postRoles } from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { isRoleNameTaken } from '../api-errors'
import { RolesForm } from '../components/roles-form'
import type { CreateRoleInput, RoleFormValues } from '../types'
import { roleFormValidate } from '../validation'
import { rolesCreateRoute } from '.'

export function RolesCreate() {
  const navigate = rolesCreateRoute.useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  const { mutate: createRole, isPending } = useMutation({
    mutationFn: (data: CreateRoleInput) => postRoles(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRolesSuspenseQueryKey(),
      })
    },
  })

  const form = useForm<RoleFormValues>({
    initialValues: {
      name: '',
      description: '',
      isDefault: false,
    },
    validate: roleFormValidate,
  })

  const handleSubmit = (values: RoleFormValues) => {
    createRole(
      {
        name: values.name,
        description: values.description,
        isDefault: values.isDefault,
      },
      {
        onSuccess: () => {
          notify({ status: 'success', message: t('notifications.created') })
          navigate({ to: '/roles' })
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
    <Form<RoleFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title={t('create.title')}
        footerActions={
          <Group justify="flex-end">
            <Button
              size="md"
              variant="default"
              disabled={isPending}
              onClick={() => navigate({ to: '/roles' })}
            >
              {tc('actions.cancel')}
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              {tc('actions.save')}
            </Button>
          </Group>
        }
      >
        <RolesForm form={form} />
      </PageCreate>
    </Form>
  )
}
