import { patchRolesId, useGetRolesIdSuspense } from '@helix/api-client/hooks'
import { Button, Form, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiErrorCode } from '@/lib/api-errors'
import { useResourceCache } from '@/lib/resource-cache'

import { RolesForm } from '../components/roles-form'
import type { RoleFormValues, UpdateRoleInput } from '../types'
import { roleFormValidate } from '../validation'
import { rolesEditRoute } from '.'

export function RolesEdit() {
  const { id } = rolesEditRoute.useParams()
  const navigate = rolesEditRoute.useNavigate()
  const resourceCache = useResourceCache()
  const { t } = useTranslation('roles')
  const { t: tc } = useTranslation('common')

  const { data: item } = useGetRolesIdSuspense(id)
  const { mutate: updateRole, isPending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleInput }) =>
      patchRolesId(id, data),
    onSuccess: (updatedItem) => {
      void resourceCache.saved('roles', updatedItem)
    },
  })

  const form = useForm<RoleFormValues>({
    initialValues: {
      name: item.name,
      description: item.description ?? '',
      isDefault: item.isDefault,
    },
    validate: roleFormValidate,
  })

  const handleSubmit = (values: RoleFormValues) => {
    updateRole(
      {
        id,
        data: {
          name: values.name,
          description: values.description,
          isDefault: values.isDefault,
        },
      },
      {
        onSuccess: () => {
          notify({ status: 'success', message: t('notifications.updated') })
          navigate({ to: '/roles' })
        },
        onError: (error) => {
          if (apiErrorCode(error) === 'name_taken') {
            form.setFieldError('name', t('form.name.taken'))
            return
          }
          notify({ status: 'danger', message: t('notifications.updateFailed') })
        },
      }
    )
  }

  return (
    <Form<RoleFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title={t('edit.title')}
        footerActions={
          <>
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
          </>
        }
      >
        <RolesForm form={form} />
      </PageEdit>
    </Form>
  )
}
