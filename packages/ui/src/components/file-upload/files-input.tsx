import { css } from '@emotion/react'
import { Input, Loader, Text } from '@mantine/core'
import type { FileWithPath } from '@mantine/dropzone'
import { Dropzone } from '@mantine/dropzone'
import { createStyles } from '@mantine/emotion'
import { IconUpload } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { notify } from '../notifications/notify'
import { FileCard } from './file-card'
import { useUploadFieldStyles } from './upload-field-styles'
export type { ImageVariant, ImageVariants, UploadedFile } from './types'
import type { UploadedFile } from './types'

export interface FilesInputProps<T extends UploadedFile = UploadedFile> {
  value: T[]
  onChange: (files: T[]) => void
  onUpload: (file: File) => Promise<T>
  maxFiles?: number
  accept?: string[]
  label?: string
  description?: string
  required?: boolean
  error?: string
}

/**
 * A multi-file upload field: a drop area with "N of M files uploaded", then
 * the files in one bordered list, each with "Remove".
 */
export function FilesInput<T extends UploadedFile>(
  props: Readonly<FilesInputProps<T>>
) {
  const {
    value,
    onChange,
    onUpload,
    maxFiles = 10,
    accept,
    label,
    description,
    required,
    error,
  } = props

  const { classes, cx } = useUploadFieldStyles()
  const { classes: own } = useStyles()
  const { t } = useTranslation('ui')
  const [uploadingCount, setUploadingCount] = useState(0)

  const remaining = maxFiles - value.length
  const isAtLimit = remaining <= 0

  const handleDrop = async (files: FileWithPath[]) => {
    const filesToUpload = files.slice(0, remaining)
    if (filesToUpload.length === 0) return

    setUploadingCount((n) => n + filesToUpload.length)
    const results = await Promise.allSettled(filesToUpload.map(onUpload))
    setUploadingCount((n) => n - filesToUpload.length)

    const successful = results
      .filter(
        (r): r is PromiseFulfilledResult<Awaited<T>> => r.status === 'fulfilled'
      )
      .map((r) => r.value)

    const failedCount = results.filter((r) => r.status === 'rejected').length
    if (failedCount > 0) {
      notify({
        status: 'danger',
        message: t('fileUpload.uploadFailedCount', { count: failedCount }),
      })
    }

    if (successful.length > 0) onChange([...value, ...successful])
  }

  const handleRemove = (id: string) => {
    onChange(value.filter((upload) => upload.id !== id))
  }

  const count = t('fileUpload.uploadedCount', {
    count: value.length,
    max: maxFiles,
  })

  return (
    <Input.Wrapper
      label={label}
      description={description}
      required={required}
      error={error}
      classNames={{ description: classes.description }}
    >
      <div className={classes.body}>
        {isAtLimit ? (
          <Text size="sm" c="dimmed">
            {count}
          </Text>
        ) : (
          <Dropzone
            onDrop={handleDrop}
            accept={accept}
            className={cx(classes.dropzone, error && classes.error)}
          >
            <div className={cx(classes.dropzoneContent, own.tall)}>
              <IconUpload size={20} />
              <div className={own.text}>
                <Text size="sm">
                  <strong className={classes.cta}>
                    {t('fileUpload.clickToUpload')}
                  </strong>{' '}
                  {t('fileUpload.orDropMany')}
                </Text>
                <Text size="xs" c="dimmed">
                  {count}
                </Text>
              </div>
            </div>
          </Dropzone>
        )}

        {(value.length > 0 || uploadingCount > 0) && (
          <ul className={own.list}>
            {value.map((upload) => (
              <li key={upload.id}>
                <FileCard
                  upload={upload}
                  onRemove={handleRemove}
                  bordered={false}
                />
              </li>
            ))}
            {Array.from({ length: uploadingCount }).map((_, i) => (
              <li key={`uploading-${i}`} className={own.uploadingRow}>
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  {t('fileUpload.uploading')}
                </Text>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Input.Wrapper>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  tall: css`
    min-height: 72px;
    padding: ${theme.spacing.sm} 0;
  `,
  text: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  `,
  list: css`
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: ${theme.radius.md};
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
    }

    & > li + li {
      ${u.light} {
        border-top: 1px solid ${theme.colors.gray[2]};
      }
      ${u.dark} {
        border-top: 1px solid ${theme.colors.dark[6]};
      }
    }
  `,
  uploadingRow: css`
    min-height: 60px;
    padding: 0 ${theme.spacing.sm};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
  `,
}))
