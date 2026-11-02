import { css } from '@emotion/react'
import { Button, Text } from '@mantine/core'
import { createStyles } from '@mantine/emotion'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { FileTile } from './file-tile'
import type { UploadedFile } from './types'
import { formatFileSize } from './utils'

export interface FileCardProps {
  upload: UploadedFile
  onRemove: (id: string) => void
  /** After the size — e.g. the accepted types. */
  hint?: ReactNode
  /** Before "Remove" — e.g. `FileInput`'s "Replace". */
  extraAction?: ReactNode
  /** `false` inside a list that draws the borders itself. */
  bordered?: boolean
}

/** An uploaded file in a form field: tile, name, size and its actions. */
export function FileCard(props: Readonly<FileCardProps>) {
  const { upload, onRemove, hint, extraAction, bordered = true } = props

  const { classes, cx } = useStyles()
  const { t } = useTranslation('ui')

  return (
    <div className={cx(classes.card, bordered && classes.bordered)}>
      <FileTile upload={upload} />

      <div className={classes.info}>
        <Text size="sm" fw={500} truncate="end" title={upload.originalName}>
          {upload.originalName}
        </Text>
        <Text size="xs" c="dimmed">
          {formatFileSize(upload.fileSize)}
          {hint && <> · {hint}</>}
        </Text>
      </div>

      <div className={classes.actions}>
        {extraAction}
        <Button
          variant="default"
          size="xs"
          aria-label={t('fileUpload.removeFile', { name: upload.originalName })}
          onClick={() => onRemove(upload.id)}
        >
          {t('fileUpload.remove')}
        </Button>
      </div>
    </div>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  card: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    min-height: 60px;
    padding: 10px ${theme.spacing.sm};
  `,
  bordered: css`
    border-radius: ${theme.radius.md};
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
      background-color: ${theme.white};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
      background-color: ${theme.colors.dark[6]};
    }
  `,
  info: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  actions: css`
    display: flex;
    flex-shrink: 0;
    gap: ${theme.spacing.xs};
  `,
}))
