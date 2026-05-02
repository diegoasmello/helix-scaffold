import type { UseFormReturnType } from '@helix/ui'
import {
  DateInput,
  Grid,
  RichTextEditor,
  Switch,
  Textarea,
  TextInput,
} from '@helix/ui'

import type { TodoFormValues } from '../types'

interface TodoFormProps {
  form: UseFormReturnType<TodoFormValues>
}

export function TodoForm(props: Readonly<TodoFormProps>) {
  const { form } = props

  return (
    <Grid>
      <Grid.Col span={12}>
        <TextInput
          label="Title"
          placeholder="Todo title"
          {...form.getInputProps('title')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Textarea
          label="Description"
          description="Write a large content"
          placeholder="Todo description"
          resize="vertical"
          {...form.getInputProps('description')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <RichTextEditor
          label="Content"
          description="Write a large content"
          placeholder="Todo content"
          {...form.getInputProps('content')}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <DateInput
          label="Date"
          placeholder="Pick a date"
          {...form.getInputProps('date')}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <Switch
          mt="xl"
          label="Completed"
          checked={form.values.status === 'completed'}
          onChange={(e) =>
            form.setFieldValue(
              'status',
              e.currentTarget.checked ? 'completed' : 'pending'
            )
          }
        />
      </Grid.Col>
    </Grid>
  )
}
