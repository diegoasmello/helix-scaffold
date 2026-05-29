import { getTodosSuspenseQueryKey, postTodos } from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageCreate, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { TodoForm } from '../components/todos-form'
import type { CreateTodoInput, TodoFormValues } from '../types'
import { todoFormValidate } from '../validation'
import { todoCreateRoute } from '.'

export function TodoCreate() {
  const navigate = todoCreateRoute.useNavigate()
  const queryClient = useQueryClient()

  const { mutate: createTodo, isPending } = useMutation({
    mutationFn: (data: CreateTodoInput) => postTodos(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getTodosSuspenseQueryKey(),
      })
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
            message: 'Todo created successfully',
          })
          navigate({ to: '/todos' })
        },
        onError: () => {
          notify({
            status: 'danger',
            message: 'Failed to create todo',
          })
        },
      }
    )
  }

  return (
    <Form<TodoFormValues> form={form} onSubmit={handleSubmit}>
      <PageCreate
        title="Create Todo"
        footerActions={
          <Group justify="flex-end">
            <Button
              size="md"
              variant="secondary"
              disabled={isPending || form.submitting}
              onClick={() => navigate({ to: '/todos' })}
            >
              Cancel
            </Button>
            <Button
              size="md"
              type="submit"
              loading={isPending || form.submitting}
            >
              Save
            </Button>
          </Group>
        }
      >
        <TodoForm form={form} />
      </PageCreate>
    </Form>
  )
}
