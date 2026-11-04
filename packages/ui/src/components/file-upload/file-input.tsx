import { Button, FileButton, Input, Loader, Text } from '@mantine/core'
import type { FileWithPath } from '@mantine/dropzone'
import { Dropzone } from '@mantine/dropzone'
import { IconUpload } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { notify } from '../notifications/notify'
import { FileCard } from './file-card'
import type { UploadedFile } from './types'
import { useUploadFieldStyles } from './upload-field-styles'

export interface FileInputProps<T extends UploadedFile = UploadedFile> {
  value: T | null
  onChange: (file: T | null) => void
  onUpload: (file: File) => Promise<T>
  accept?: string[]
  label?: string
  description?: string
  required?: boolean
  error?: string
}

/**
 * A single-file upload field: a drop area while empty, then the file with
 * "Replace" and "Remove". The HTTP call is injected (`onUpload`).
 */
export function FileInput<T extends UploadedFile>(
  props: Readonly<FileInputProps<T>>
) {
  const {
    value,
    onChange,
    onUpload,
    accept,
    label,
    description,
    required,
    error,
  } = props

  const { classes, cx } = useUploadFieldStyles()
  const { t } = useTranslation('ui')
  const [isUploading, setIsUploading] = useState(false)
  const id = useId()

  const upload = async (file: File | null | undefined) => {
    if (!file) return

    setIsUploading(true)
    try {
      onChange(await onUpload(file))
    } catch {
      notify({ status: 'danger', message: t('fileUpload.uploadFailed') })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Input.Wrapper
      id={id}
      role="group"
      aria-labelledby={label ? `${id}-label` : undefined}
      label={label}
      description={description}
      required={required}
      error={error}
      classNames={{ description: classes.description }}
    >
      <div className={classes.body}>
        {isUploading ? (
          <div className={cx(classes.uploading, error && classes.error)}>
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              {t('fileUpload.uploading')}
            </Text>
          </div>
        ) : value ? (
          <FileCard
            upload={value}
            onRemove={() => onChange(null)}
            extraAction={
              <FileButton onChange={upload} accept={accept?.join(',')}>
                {(buttonProps) => (
                  <Button variant="default" size="xs" {...buttonProps}>
                    {t('fileUpload.replace')}
                  </Button>
                )}
              </FileButton>
            }
          />
        ) : (
          <Dropzone
            onDrop={(files: FileWithPath[]) => upload(files[0])}
            accept={accept}
            maxFiles={1}
            className={cx(classes.dropzone, error && classes.error)}
          >
            <div className={classes.dropzoneContent}>
              <IconUpload size={18} />
              <Text size="sm">
                <strong className={classes.cta}>
                  {t('fileUpload.clickToUpload')}
                </strong>{' '}
                {t('fileUpload.orDropOne')}
              </Text>
            </div>
          </Dropzone>
        )}
      </div>
    </Input.Wrapper>
  )
}
