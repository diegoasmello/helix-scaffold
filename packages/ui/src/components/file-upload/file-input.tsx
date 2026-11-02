import { css } from '@emotion/react'
import { Box, Group, Input, Loader, Stack, Text } from '@mantine/core'
import type { FileWithPath } from '@mantine/dropzone'
import { Dropzone } from '@mantine/dropzone'
import { createStyles } from '@mantine/emotion'
import { IconUpload, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  required?: boolean
  error?: string
}

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

  const { classes, cx } = useStyles()
  const { t } = useTranslation('ui')
  const [isUploading, setIsUploading] = useState(false)

  const handleDrop = async (files: FileWithPath[]) => {
    const file = files[0]
    if (!file) return

    setIsUploading(true)
    try {
      const uploaded = await onUpload(file)
      onChange(uploaded)
    } catch {
      notify({ status: 'danger', message: t('fileUpload.uploadFailed') })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Input.Wrapper
      label={label}
      description={description}
      required={required}
      error={error}
    >
      <Box mt={description ? 4 : undefined} mb={error ? 4 : undefined}>
        {value ? (
          <FileCard upload={value} onRemove={() => onChange(null)} />
        ) : isUploading ? (
          <Group
            className={cx(classes.loadingCard, error && classes.cardError)}
            gap="sm"
            wrap="nowrap"
          >
            <Stack
              className={classes.loadingIcon}
              align="center"
              justify="center"
            >
              <Loader size="xs" />
            </Stack>
            <Text size="sm" c="dimmed">
              {t('fileUpload.uploading')}
            </Text>
          </Group>
        ) : (
          <Dropzone
            onDrop={handleDrop}
            accept={accept}
            maxFiles={1}
            classNames={{ root: error ? classes.dropzoneError : undefined }}
          >
            <Group
              justify="center"
              gap="sm"
              className={classes.dropzoneContent}
            >
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
                {t('fileUpload.dropFile')}
              </Text>
            </Group>
          </Dropzone>
        )}
      </Box>
    </Input.Wrapper>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  dropzoneContent: css`
    pointer-events: none;
    height: 60px;
  `,
  dropzoneError: css`
    border-color: ${theme.colors.red[6]};
    border-style: solid;

    &:focus,
    &:focus-visible {
      outline-color: ${theme.colors.red[6]};
    }
  `,
  loadingCard: css`
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
    }
    border-radius: ${theme.radius.md};
    padding: 0 ${theme.spacing.sm};
    ${u.light} {
      background: ${theme.white};
    }
    ${u.dark} {
      background: ${theme.colors.dark[6]};
    }
    height: 60px;
  `,
  cardError: css`
    border-color: ${theme.colors.red[6]};
  `,
  loadingIcon: css`
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.xs};
    ${u.light} {
      background: ${theme.colors.gray[1]};
    }
    ${u.dark} {
      background: ${theme.colors.dark[5]};
    }
    ${u.light} {
      color: ${theme.colors.gray[5]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[3]};
    }
    flex-shrink: 0;
  `,
}))
