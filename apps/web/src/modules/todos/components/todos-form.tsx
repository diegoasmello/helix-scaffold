import type { UseFormReturnType } from '@helix/ui'
import {
  DateInput,
  FileInput,
  FilesInput,
  Grid,
  Image,
  IMAGE_MIME_TYPE,
  PDF_MIME_TYPE,
  RichTextEditor,
  Switch,
  Textarea,
  TextInput,
} from '@helix/ui'

import { uploadFile } from '@/modules/uploads/service'

import type { TodoFormValues } from '../types'

interface TodoFormProps {
  form: UseFormReturnType<TodoFormValues>
}

export function TodoForm(props: Readonly<TodoFormProps>) {
  const { form } = props

  return (
    <Grid>
      <Grid.Col span={12}>
        {form.values.image && (
          <Image
            src={form.values.image.url}
            radius="md"
            mah={300}
            w="auto"
            fit="contain"
            mb="xs"
          />
        )}
        <FileInput
          label="Image"
          description="JPEG, PNG, WebP or GIF"
          required
          value={form.values.image}
          onChange={(upload) => form.setFieldValue('image', upload)}
          onUpload={uploadFile}
          accept={IMAGE_MIME_TYPE}
          error={form.errors.image as string | undefined}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <TextInput
          label="Title"
          placeholder="Todo title"
          required
          {...form.getInputProps('title')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Textarea
          label="Description"
          description="Write a large content"
          placeholder="Todo description"
          resize="vertical"
          required
          {...form.getInputProps('description')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <RichTextEditor
          label="Content"
          description="Write a large content"
          placeholder="Todo content"
          required
          {...form.getInputProps('content')}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <DateInput
          label="Date"
          placeholder="Pick a date"
          required={form.values.status !== 'pending'}
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
      <Grid.Col span={12}>
        <FilesInput
          label="Attachments"
          description="Upload up to 10 files of any type"
          required
          value={form.values.attachments}
          onChange={(uploads) => form.setFieldValue('attachments', uploads)}
          onUpload={uploadFile}
          error={form.errors.attachments as string | undefined}
          maxFiles={10}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <FileInput
          label="File (PDF)"
          description="Only PDF documents are accepted"
          required
          value={form.values.file}
          onChange={(upload) => form.setFieldValue('file', upload)}
          onUpload={uploadFile}
          accept={PDF_MIME_TYPE}
          error={form.errors.file as string | undefined}
        />
      </Grid.Col>
    </Grid>
  )
}
