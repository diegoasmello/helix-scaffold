import { css } from '@emotion/react'
import { Anchor, Group, Image, Stack, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'

import type { UploadedFile } from './types'
import { formatFileSize, getFileIcon } from './utils'

export interface FilePreviewProps {
  upload: UploadedFile
}

export function FilePreview(props: Readonly<FilePreviewProps>) {
  const { upload } = props

  const { classes } = useStyles()
  const isImage =
    upload.mimeType.startsWith('image/') && upload.variants !== null

  return (
    <Anchor
      href={upload.url}
      target="_blank"
      rel="noopener noreferrer"
      className={classes.link}
    >
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

        <Stack gap={2} className={classes.fileInfo}>
          <Text size="sm" truncate="end" title={upload.originalName}>
            {upload.originalName}
          </Text>
          <Text size="xs" c="dimmed">
            {formatFileSize(upload.fileSize)}
          </Text>
        </Stack>
      </Group>
    </Anchor>
  )
}

const useStyles = createStyles((theme) => ({
  link: css`
    text-decoration: none;
    color: inherit;
    display: block;
  `,
  card: css`
    border: 1px solid ${theme.colors.gray[3]};
    border-radius: ${theme.radius.sm};
    padding: 0 ${theme.spacing.sm};
    background: ${theme.white};
    height: 60px;
    transition: box-shadow 150ms ease;

    &:hover {
      box-shadow: ${theme.shadows.sm};
    }
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
