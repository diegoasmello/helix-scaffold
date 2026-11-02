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

        <Stack gap={4} className={classes.fileInfo}>
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

const useStyles = createStyles((theme, _, u) => ({
  link: css`
    text-decoration: none;
    color: inherit;
    display: block;
  `,
  card: css`
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
    transition: border-color 150ms ease;

    &:hover {
      ${u.light} {
        border-color: ${theme.colors.gray[4]};
      }
      ${u.dark} {
        border-color: ${theme.colors.dark[3]};
      }
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
    ${u.light} {
      background: ${theme.colors.gray[1]};
    }
    ${u.dark} {
      background: ${theme.colors.dark[5]};
    }
    ${u.light} {
      color: ${theme.colors.gray[6]};
    }
    ${u.dark} {
      color: ${theme.colors.dark[2]};
    }
    flex-shrink: 0;
  `,
  fileInfo: css`
    flex: 1;
    min-width: 0;
  `,
}))
