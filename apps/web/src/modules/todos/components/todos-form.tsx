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
import { useTranslation } from 'react-i18next'

import { uploadFile } from '@/modules/uploads/service'

import type { TodoFormValues } from '../types'

interface TodoFormProps {
  form: UseFormReturnType<TodoFormValues>
}

export function TodoForm(props: Readonly<TodoFormProps>) {
  const { form } = props
  const { t } = useTranslation('todos')

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
          label={t('form.image.label')}
          description={t('form.image.description')}
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
          label={t('form.title.label')}
          placeholder={t('form.title.placeholder')}
          required
          {...form.getInputProps('title')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <Textarea
          label={t('form.description.label')}
          description={t('form.description.description')}
          placeholder={t('form.description.placeholder')}
          resize="vertical"
          required
          {...form.getInputProps('description')}
        />
      </Grid.Col>
      <Grid.Col span={12}>
        <RichTextEditor
          label={t('form.content.label')}
          description={t('form.content.description')}
          placeholder={t('form.content.placeholder')}
          required
          onUploadImage={uploadFile}
          {...form.getInputProps('content')}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <DateInput
          label={t('form.date.label')}
          placeholder={t('form.date.placeholder')}
          required={form.values.status !== 'pending'}
          {...form.getInputProps('date')}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <Switch
          mt="xl"
          label={t('form.status.label')}
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
          label={t('form.attachments.label')}
          description={t('form.attachments.description')}
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
          label={t('form.file.label')}
          description={t('form.file.description')}
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
