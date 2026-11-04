import type { UseFormReturnType } from '@helix/ui'
import {
  createStyles,
  css,
  DateInput,
  FileInput,
  FilesInput,
  FormSection,
  IMAGE_MIME_TYPE,
  PDF_MIME_TYPE,
  RichTextEditor,
  SimpleGrid,
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
  const { classes } = useStyles()

  return (
    <>
      <FormSection
        title={t('sections.basic')}
        description={t('sections.basicDescription')}
      >
        <TextInput
          label={t('form.title.label')}
          placeholder={t('form.title.placeholder')}
          required
          {...form.getInputProps('title')}
        />
        <Textarea
          label={t('form.description.label')}
          description={t('form.description.description')}
          placeholder={t('form.description.placeholder')}
          resize="vertical"
          rows={3}
          required
          {...form.getInputProps('description')}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <DateInput
            label={t('form.date.label')}
            placeholder={t('form.date.placeholder')}
            required
            {...form.getInputProps('date')}
          />
          <Switch
            className={classes.switch}
            label={t('form.status.label')}
            checked={form.values.status === 'completed'}
            onChange={(e) =>
              form.setFieldValue(
                'status',
                e.currentTarget.checked ? 'completed' : 'pending'
              )
            }
          />
        </SimpleGrid>
      </FormSection>

      <FormSection
        title={t('sections.body')}
        description={t('sections.bodyDescription')}
      >
        <RichTextEditor
          label={t('form.content.label')}
          description={t('form.content.description')}
          placeholder={t('form.content.placeholder')}
          required
          onUploadImage={uploadFile}
          {...form.getInputProps('content')}
        />
      </FormSection>

      <FormSection
        title={t('sections.files')}
        description={t('sections.filesDescription')}
      >
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
      </FormSection>
    </>
  )
}

const useStyles = createStyles((theme) => ({
  // Lines the switch up with the date input next to it (label height).
  switch: css`
    padding-top: 30px;

    @media (max-width: calc(${theme.breakpoints.xs} - 0.0625em)) {
      padding-top: 0;
    }
  `,
}))
