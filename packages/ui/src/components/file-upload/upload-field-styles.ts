import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'

/** Shared by `FileInput` and `FilesInput`: the drop area and its states. */
export const useUploadFieldStyles = createStyles((theme, _, u) => ({
  description: css`
    margin-bottom: 6px;
  `,
  /* The same space Mantine leaves between an input and its error. */
  errorMessage: css`
    margin-top: calc(${theme.spacing.xs} / 2);
  `,
  body: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing.xs};
  `,
  dropzone: css`
    border-style: dashed;
    border-width: 1px;
    border-radius: ${theme.radius.md};
    ${u.light} {
      border-color: ${theme.colors.gray[4]};
      background-color: ${theme.colors.gray[0]};
      color: ${theme.colors.gray[7]};
    }
    ${u.dark} {
      border-color: ${theme.colors.dark[4]};
      background-color: ${theme.colors.dark[8]};
      color: ${theme.colors.dark[1]};
    }

    /* :focus, not :focus-visible: like the inputs' ring, it must show when
       Form focuses the field after a mouse click on Save. */
    &:focus {
      outline: 2px solid ${theme.colors[theme.primaryColor][6]};
      outline-offset: 2px;
      animation: var(--helix-focus-ring-animation);
    }
  `,
  dropzoneContent: css`
    pointer-events: none;
    min-height: 40px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing.xs};
    text-align: center;
  `,
  cta: css`
    font-weight: 600;
    color: ${theme.colors[theme.primaryColor][6]};
  `,
  error: css`
    border-color: ${theme.colors.red[6]};

    &:focus {
      outline-color: ${theme.colors.red[6]};
    }
  `,
  uploading: css`
    min-height: 60px;
    padding: 0 ${theme.spacing.sm};
    display: flex;
    align-items: center;
    gap: ${theme.spacing.sm};
    border-radius: ${theme.radius.md};
    ${u.light} {
      border: 1px solid ${theme.colors.gray[3]};
    }
    ${u.dark} {
      border: 1px solid ${theme.colors.dark[5]};
    }
  `,
}))
