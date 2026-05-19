import {
  getTodosIdSuspenseQueryKey,
  getTodosSuspenseQueryKey,
  patchTodosId,
  useGetTodosIdSuspense,
} from '@helix/api-client/hooks'
import { Button, Form, Group, notify, PageEdit, useForm } from '@helix/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { TodoForm } from '../components/todos-form'
import type { TodoFormValues, UpdateTodoInput } from '../types'
import { todoFormValidate } from '../validation'
import { todoEditRoute } from '.'

export function TodoEdit() {
  const { id } = todoEditRoute.useParams()
  const navigate = todoEditRoute.useNavigate()

  const queryClient = useQueryClient()

  const { data: item } = useGetTodosIdSuspense(id)

  const { mutate: updateTodo, isPending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTodoInput }) =>
      patchTodosId(id, data),
    onSuccess: (updatedItem) => {
      queryClient.invalidateQueries({
        queryKey: getTodosSuspenseQueryKey(),
      })
      queryClient.setQueryData(
        getTodosIdSuspenseQueryKey(updatedItem.id),
        updatedItem
      )
    },
  })

  const form = useForm<TodoFormValues>({
    initialValues: {
      title: item.title,
      description: item.description,
      content: item.content,
      date: item.date,
      status: item.status,
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
        },
      },
      {
        onSuccess: () => {
          notify({
            status: 'success',
            message: 'Todo updated successfully',
          })
          navigate({ to: '/todos' })
        },
        onError: () => {
          notify({ status: 'danger', message: 'Failed to update todo' })
        },
      }
    )
  }

  return (
    <Form<TodoFormValues> form={form} onSubmit={handleSubmit}>
      <PageEdit
        title="Edit Todo"
        footerActions={
          <Group justify="flex-end">
            <Button
              size="md"
              variant="secondary"
              disabled={isPending}
              onClick={() => navigate({ to: '/todos' })}
            >
              Cancel
            </Button>
            <Button size="md" type="submit" loading={isPending}>
              Save
            </Button>
          </Group>
        }
      >
        <TodoForm form={form} />
      </PageEdit>
    </Form>
  )
}
