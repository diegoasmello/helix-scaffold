import { css } from '@emotion/react'
import { Anchor, Group, Stack, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'

import { FileTile } from './file-tile'
import type { UploadedFile } from './types'
import { formatFileSize } from './utils'

export interface FilePreviewProps {
  upload: UploadedFile
}

export function FilePreview(props: Readonly<FilePreviewProps>) {
  const { upload } = props

  const { classes } = useStyles()

  return (
    <Anchor
      href={upload.url}
      target="_blank"
      rel="noopener noreferrer"
      className={classes.link}
    >
      <Group className={classes.card} gap="sm" wrap="nowrap">
        <FileTile upload={upload} />

        <Stack gap={4} className={classes.fileInfo}>
          <Text size="sm" fw={500} truncate="end" title={upload.originalName}>
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
  fileInfo: css`
    flex: 1;
    min-width: 0;
  `,
}))
