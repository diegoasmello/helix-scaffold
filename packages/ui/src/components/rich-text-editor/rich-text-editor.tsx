import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { Link, RichTextEditor as TipTapEditor } from '@mantine/tiptap'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import SubScript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useId } from 'react'

import { clsx, Input, type InputWrapperProps } from '../..'

export interface RichTextEditorProps extends Omit<
  InputWrapperProps,
  'onChange' | 'onFocus' | 'onBlur'
> {
  placeholder?: string
  value?: string
  resizable?: boolean
  onChange?: (value: string) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  'data-path'?: string
}

export function RichTextEditor(props: Readonly<RichTextEditorProps>) {
  const {
    label,
    description,
    error,
    placeholder,
    value,
    resizable = true,
    onChange,
    onFocus,
    onBlur,
    'data-path': dataPath,
  } = props

  const id = useId()
  const { classes } = useStyles()

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: false }),
      Link,
      Superscript,
      SubScript,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        'aria-labelledby': `${id}-label`,
        role: 'textbox',
      },
    },
    immediatelyRender: true,
    content: value,
    enableContentCheck: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange?.(html)
    },
    onFocus: ({ event }) => {
      onFocus?.(event)
    },
    onBlur: ({ event }) => {
      onBlur?.(event)
    },
  })

  const hasError = !!error

  return (
    <Input.Wrapper
      id={id}
      label={label}
      description={description}
      error={error}
      onClick={(e) => {
        if ((e.target as HTMLElement).id === `${id}-label`) {
          editor.commands.focus()
        }
      }}
    >
      <TipTapEditor
        editor={editor}
        className={clsx(classes.editor, {
          [classes.editorWithError]: hasError,
          [classes.editorFocused]: editor?.isFocused && !hasError,
          [classes.editorFocusedError]: editor?.isFocused && hasError,
        })}
      >
        <TipTapEditor.Toolbar sticky stickyOffset="var(--docs-header-height)">
          <TipTapEditor.ControlsGroup>
            <TipTapEditor.Bold />
            <TipTapEditor.Italic />
            <TipTapEditor.Underline />
            <TipTapEditor.Strikethrough />
            <TipTapEditor.ClearFormatting />
            <TipTapEditor.Highlight />
            <TipTapEditor.Code />
          </TipTapEditor.ControlsGroup>

          <TipTapEditor.ControlsGroup>
            <TipTapEditor.H1 />
            <TipTapEditor.H2 />
            <TipTapEditor.H3 />
            <TipTapEditor.H4 />
          </TipTapEditor.ControlsGroup>

          <TipTapEditor.ControlsGroup>
            <TipTapEditor.Blockquote />
            <TipTapEditor.Hr />
            <TipTapEditor.BulletList />
            <TipTapEditor.OrderedList />
            <TipTapEditor.Subscript />
            <TipTapEditor.Superscript />
          </TipTapEditor.ControlsGroup>

          <TipTapEditor.ControlsGroup>
            <TipTapEditor.Link />
            <TipTapEditor.Unlink />
          </TipTapEditor.ControlsGroup>

          <TipTapEditor.ControlsGroup>
            <TipTapEditor.AlignLeft />
            <TipTapEditor.AlignCenter />
            <TipTapEditor.AlignJustify />
            <TipTapEditor.AlignRight />
          </TipTapEditor.ControlsGroup>

          <TipTapEditor.ControlsGroup>
            <TipTapEditor.Undo />
            <TipTapEditor.Redo />
          </TipTapEditor.ControlsGroup>
        </TipTapEditor.Toolbar>

        <TipTapEditor.Content
          className={clsx(classes.content, {
            [classes.contentWithError]: hasError,
            [classes.contentResizable]: resizable,
          })}
          id={id}
          data-path={dataPath}
          tabIndex={1}
          onFocus={() => editor.commands.focus()}
        />
      </TipTapEditor>
    </Input.Wrapper>
  )
}

const useStyles = createStyles((theme) => ({
  editor: css`
    margin-top: calc(${theme.spacing.xs} / 2);
    margin-bottom: calc(${theme.spacing.xs} / 2);
  `,
  editorWithError: css`
    border: 1px solid ${theme.colors.red[7]};
  `,
  editorFocused: css`
    outline: 2px solid var(--mantine-primary-color-filled);
    outline-offset: calc(0.125rem * var(--mantine-scale));
  `,
  editorFocusedError: css`
    outline: 2px solid var(--mantine-color-error);
    outline-offset: calc(0.125rem * var(--mantine-scale));
  `,
  content: css`
    display: flex;
    flex-direction: column;
    min-height: 8rem;
    font-size: ${theme.fontSizes.sm};

    & > div {
      display: flex;
      flex-direction: column;
      flex: 1;

      & > div {
        flex: 1;
        padding: ${theme.spacing.xs} ${theme.spacing.sm}!important;
      }
    }
  `,
  contentWithError: css`
    & > div > div p::before {
      color: ${theme.colors.red[5]}!important;
    }
  `,
  contentResizable: css`
    resize: vertical;
    overflow: auto;
  `,
}))
