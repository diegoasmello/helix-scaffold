import { css } from '@emotion/react'
import { Group, Input, Loader, Stack, Text } from '@mantine/core'
import type { FileWithPath } from '@mantine/dropzone'
import { Dropzone } from '@mantine/dropzone'
import { createStyles } from '@mantine/emotion'
import { IconUpload, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import { notify } from '../notifications/notify'
import { FileCard } from './file-card'
import type { UploadedFile } from './types'

export interface FileInputProps<T extends UploadedFile = UploadedFile> {
  value: T | null
  onChange: (file: T | null) => void
  onUpload: (file: File) => Promise<T>
  accept?: string[]
  label?: string
  description?: string
  error?: string
}

export function FileInput<T extends UploadedFile>(
  props: Readonly<FileInputProps<T>>
) {
  const { value, onChange, onUpload, accept, label, description, error } = props

  const { classes } = useStyles()
  const [isUploading, setIsUploading] = useState(false)

  const handleDrop = async (files: FileWithPath[]) => {
    const file = files[0]
    if (!file) return

    setIsUploading(true)
    try {
      const uploaded = await onUpload(file)
      onChange(uploaded)
    } catch {
      notify({ status: 'danger', message: 'Failed to upload file' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Input.Wrapper label={label} description={description} error={error}>
      {value ? (
        <FileCard upload={value} onRemove={() => onChange(null)} />
      ) : isUploading ? (
        <Group className={classes.loadingCard} gap="sm" wrap="nowrap">
          <Stack
            className={classes.loadingIcon}
            align="center"
            justify="center"
          >
            <Loader size="xs" />
          </Stack>
          <Text size="sm" c="dimmed">
            Uploading…
          </Text>
        </Group>
      ) : (
        <Dropzone onDrop={handleDrop} accept={accept} maxFiles={1}>
          <Group justify="center" gap="sm" className={classes.dropzoneContent}>
            <Dropzone.Accept>
              <IconUpload size={18} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={18} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconUpload size={18} />
            </Dropzone.Idle>
            <Text size="sm" c="dimmed">
              Drop a file or click to select
            </Text>
          </Group>
        </Dropzone>
      )}
    </Input.Wrapper>
  )
}

const useStyles = createStyles((theme) => ({
  dropzoneContent: css`
    pointer-events: none;
    height: 60px;
  `,
  loadingCard: css`
    border: 1px solid ${theme.colors.gray[3]};
    border-radius: ${theme.radius.sm};
    padding: 0 ${theme.spacing.sm};
    background: ${theme.white};
    height: 60px;
  `,
  loadingIcon: css`
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.xs};
    background: ${theme.colors.gray[1]};
    color: ${theme.colors.gray[5]};
    flex-shrink: 0;
  `,
}))
