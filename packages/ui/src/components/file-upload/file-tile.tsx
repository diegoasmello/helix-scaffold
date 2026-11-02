import { css } from '@emotion/react'
import { Image } from '@mantine/core'
import { createStyles } from '@mantine/emotion'

import type { UploadedFile } from './types'

export interface FileTileProps {
  upload: UploadedFile
}

/** The file's square: its thumbnail for images, its extension otherwise. */
export function FileTile(props: Readonly<FileTileProps>) {
  const { upload } = props

  const { classes, cx } = useStyles()

  if (upload.mimeType.startsWith('image/') && upload.variants) {
    return (
      <Image
        src={upload.variants.thumbnail.url}
        alt=""
        className={classes.tile}
        fit="cover"
      />
    )
  }

  const extension =
    upload.originalName.split('.').pop()?.slice(0, 4).toUpperCase() ?? ''
  const isPdf = upload.mimeType === 'application/pdf'

  return (
    <span
      aria-hidden
      className={cx(classes.tile, classes.extension, isPdf && classes.pdf)}
    >
      {extension}
    </span>
  )
}

const useStyles = createStyles((theme, _, u) => ({
  tile: css`
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: ${theme.radius.md};
    display: block;
  `,
  extension: css`
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
      background-color: ${theme.colors.gray[0]};
      color: ${theme.colors.gray[7]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
      background-color: ${theme.colors.dark[6]};
      color: ${theme.colors.dark[1]};
    }
  `,
  pdf: css`
    ${u.light} {
      border-color: #fecdca;
      background-color: #fef3f2;
      color: #b42318;
    }
    ${u.dark} {
      border-color: rgba(240, 68, 56, 0.35);
      background-color: rgba(240, 68, 56, 0.1);
      color: #fda29b;
    }
  `,
}))
