import { css } from '@emotion/react'
import { ActionIcon, Group, Image, Stack, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import { IconTrash } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import type { UploadedFile } from './types'
import { formatFileSize, getFileIcon } from './utils'

export interface FileCardProps {
  upload: UploadedFile
  onRemove: (id: string) => void
}

export function FileCard(props: Readonly<FileCardProps>) {
  const { upload, onRemove } = props

  const { classes } = useStyles()
  const { t } = useTranslation('ui')
  const isImage =
    upload.mimeType.startsWith('image/') && upload.variants !== null

  return (
    <Group className={classes.card} gap="sm" wrap="nowrap">
      {isImage ? (
        <Image
          src={upload.variants!.thumbnail.url}
          alt={upload.originalName}
          className={classes.thumbnail}
          fit="cover"
        />
      ) : (
        <Stack
          className={classes.fileIcon}
          align="center"
          justify="center"
          gap={0}
        >
          {getFileIcon(upload.mimeType)}
        </Stack>
      )}

      <Stack gap={4} className={classes.fileInfo}>
        <Text size="sm" truncate="end" title={upload.originalName}>
          {upload.originalName}
        </Text>
        <Text size="xs" c="dimmed">
          {formatFileSize(upload.fileSize)}
        </Text>
      </Stack>

      <ActionIcon
        variant="subtle"
        color="red"
        size="sm"
        aria-label={t('fileUpload.removeFile', { name: upload.originalName })}
        onClick={() => onRemove(upload.id)}
      >
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  )
}

const useStyles = createStyles((theme) => ({
  card: css`
    border: 1px solid ${theme.colors.gray[3]};
    border-radius: ${theme.radius.sm};
    padding: 0 ${theme.spacing.sm};
    background: ${theme.white};
    height: 60px;
  `,
  thumbnail: css`
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.xs};
    flex-shrink: 0;
    display: block;
  `,
  fileIcon: css`
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.xs};
    background: ${theme.colors.gray[1]};
    color: ${theme.colors.gray[6]};
    flex-shrink: 0;
  `,
  fileInfo: css`
    flex: 1;
    min-width: 0;
  `,
}))
