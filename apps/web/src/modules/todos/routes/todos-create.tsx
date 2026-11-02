import { postTodos } from '@helix/api-client/hooks'
import { Button, Form, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useResourceCache } from '@/lib/resource-cache'

import { TodoForm } from '../components/todos-form'
import type { CreateTodoInput, TodoFormValues } from '../types'
import { todoFormValidate } from '../validation'
import { todoCreateRoute } from '.'

export function TodoCreate() {
  const navigate = todoCreateRoute.useNavigate()
  const resourceCache = useResourceCache()
  const { t } = useTranslation('todos')
  const { t: tc } = useTranslation('common')

  const { mutate: createTodo, isPending } = useMutation({
    mutationFn: (data: CreateTodoInput) => postTodos(data),
    onSuccess: () => {
      void resourceCache.changed('todos')
    },
  })

  const form = useForm<TodoFormValues>({
    initialValues: {
      title: '',
      description: '',
      content: '',
      date: null,
      status: 'pending',
      attachments: [],
      file: null,
      image: null,
    },
    validate: todoFormValidate,
  })

  const handleSubmit = (values: TodoFormValues) => {
    createTodo(
      {
        title: values.title,
        description: values.description,
        content: values.content,
        date: values.date!,
        attachmentIds: values.attachments.map((a) => a.id),
        fileId: values.file!.id,
        imageId: values.image!.id,
      },
      {
        onSuccess: () => {
          notify({
            status: 'success',
            message: t('notifications.created'),
          })
          navigate({ to: '/todos' })
        },
        onError: () => {
          notify({
            status: 'danger',
            message: t('notifications.createFailed'),
          })
        },
      }
    )
  }

  return (
    <Form<TodoFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title={t('create.title')}
        footerActions={
          <>
            <Button
              size="md"
              variant="default"
              disabled={isPending || form.submitting}
              onClick={() => navigate({ to: '/todos' })}
            >
              {tc('actions.cancel')}
            </Button>
            <Button
              size="md"
              type="submit"
              loading={isPending || form.submitting}
            >
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        <TodoForm form={form} />
      </PageCreate>
    </Form>
  )
}
