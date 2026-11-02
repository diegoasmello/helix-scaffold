import { patchTodosId, useGetTodosIdSuspense } from '@helix/api-client/hooks'
import { Button, Form, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useResourceCache } from '@/lib/resource-cache'

import { TodoForm } from '../components/todos-form'
import type { TodoFormValues, UpdateTodoInput } from '../types'
import { todoFormValidate } from '../validation'
import { todoEditRoute } from '.'

export function TodoEdit() {
  const { id } = todoEditRoute.useParams()
  const navigate = todoEditRoute.useNavigate()
  const { t } = useTranslation('todos')
  const { t: tc } = useTranslation('common')

  const resourceCache = useResourceCache()

  const { data: item } = useGetTodosIdSuspense(id)

  const { mutate: updateTodo, isPending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTodoInput }) =>
      patchTodosId(id, data),
    onSuccess: (updatedItem) => {
      void resourceCache.saved('todos', updatedItem)
    },
  })

  const form = useForm<TodoFormValues>({
    initialValues: {
      title: item.title,
      description: item.description,
      content: item.content,
      date: item.date,
      status: item.status,
      attachments: item.attachments ?? [],
      file: item.file ?? null,
      image: item.image ?? null,
    },
    validate: todoFormValidate,
  })

  const handleSubmit = (values: TodoFormValues) => {
    updateTodo(
      {
        id,
        data: {
          title: values.title,
          description: values.description,
          content: values.content,
          date: values.date!,
          status: values.status,
          attachmentIds: values.attachments.map((a) => a.id),
          fileId: values.file!.id,
          imageId: values.image!.id,
        },
      },
      {
        onSuccess: () => {
          notify({
            status: 'success',
            message: t('notifications.updated'),
          })
          navigate({ to: '/todos' })
        },
        onError: () => {
          notify({ status: 'danger', message: t('notifications.updateFailed') })
        },
      }
    )
  }

  return (
    <Form<TodoFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title={t('edit.title')}
        footerActions={
          <>
            <Button
              size="md"
              variant="default"
              disabled={isPending}
              onClick={() => navigate({ to: '/todos' })}
            >
              {tc('actions.cancel')}
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        <TodoForm form={form} />
      </PageEdit>
    </Form>
  )
}
