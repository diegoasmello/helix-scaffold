import { css } from '@emotion/react'
import { Group, Input, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import type { FileWithPath } from '@mantine/dropzone'
import { Dropzone } from '@mantine/dropzone'
import { createStyles } from '@mantine/emotion'
import { IconUpload, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { notify } from '../notifications/notify'
import { FileCard } from './file-card'
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

  const { classes } = useStyles()
  const [uploadingCount, setUploadingCount] = useState(0)

  const remaining = maxFiles - value.length
  const isAtLimit = remaining <= 0

  const handleDrop = async (files: FileWithPath[]) => {
    const filesToUpload = files.slice(0, remaining)
    if (filesToUpload.length === 0) return

    setUploadingCount((n) => n + filesToUpload.length)

    const results = await Promise.allSettled(filesToUpload.map(onUpload))

    setUploadingCount((n) => n - filesToUpload.length)

    const successful = (
      results.filter(
        (r) => r.status === 'fulfilled'
      ) as PromiseFulfilledResult<T>[]
    ).map((r) => r.value)

    const failedCount = results.filter((r) => r.status === 'rejected').length
    if (failedCount > 0) {
      notify({
        status: 'danger',
        message: `Failed to upload ${failedCount} file${failedCount > 1 ? 's' : ''}`,
      })
    }

    if (successful.length > 0) {
      onChange([...value, ...successful])
    }
  }

  const handleRemove = (id: string) => {
    onChange(value.filter((u) => u.id !== id))
  }

  return (
    <Input.Wrapper
      label={label}
      description={description}
      required={required}
      error={error}
    >
      <Stack
        gap="xs"
        mt={description ? 4 : undefined}
        mb={error ? 4 : undefined}
      >
        {!isAtLimit && (
          <Dropzone
            onDrop={handleDrop}
            accept={accept}
            classNames={{ root: error ? classes.dropzoneError : undefined }}
          >
            <Group
              justify="center"
              gap="xl"
              mih={80}
              className={classes.dropzoneContent}
            >
              <Dropzone.Accept>
                <IconUpload size={32} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconUpload size={32} />
              </Dropzone.Idle>
              <Stack gap={4} align="center">
                <Text size="sm" fw={500}>
                  Drop files here or click to select
                </Text>
                <Text size="xs" c="dimmed">
                  {remaining} file{remaining !== 1 ? 's' : ''} remaining
                </Text>
              </Stack>
            </Group>
          </Dropzone>
        )}

        {(value.length > 0 || uploadingCount > 0) && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            {value.map((upload) => (
              <FileCard
                key={upload.id}
                upload={upload}
                onRemove={handleRemove}
              />
            ))}
            {Array.from({ length: uploadingCount }).map((_, i) => (
              <Group
                key={`uploading-${i}`}
                className={classes.uploadingCard}
                gap="sm"
                wrap="nowrap"
              >
                <Stack
                  className={classes.uploadingIcon}
                  align="center"
                  justify="center"
                >
                  <Loader size="xs" />
                </Stack>
                <Text size="sm" c="dimmed">
                  Uploading…
                </Text>
              </Group>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Input.Wrapper>
  )
}

const useStyles = createStyles((theme) => ({
  dropzoneContent: css`
    pointer-events: none;
  `,
  dropzoneError: css`
    border-color: ${theme.colors.red[6]};
    border-style: solid;

    &:focus,
    &:focus-visible {
      outline-color: ${theme.colors.red[6]};
    }
  `,
  uploadingCard: css`
    border: 1px dashed ${theme.colors.gray[4]};
    border-radius: ${theme.radius.sm};
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
    background: ${theme.colors.gray[0]};
  `,
  uploadingIcon: css`
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.xs};
    background: ${theme.colors.gray[1]};
    color: ${theme.colors.gray[5]};
    flex-shrink: 0;
  `,
}))
