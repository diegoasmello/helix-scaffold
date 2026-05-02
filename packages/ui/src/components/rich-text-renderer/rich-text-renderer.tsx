import { css } from '@emotion/react'
import { createStyles } from '@mantine/emotion'
import { Link } from '@mantine/tiptap'
import Highlight from '@tiptap/extension-highlight'
import SubScript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextAlign from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export interface RichTextRendererProps {
  value: string
}

export function RichTextRenderer(props: Readonly<RichTextRendererProps>) {
  const { value } = props

  const { classes } = useStyles()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link,
      Superscript,
      SubScript,
      Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    editable: false,
    editorProps: {
      attributes: {
        class:
          'max-w-none focus:outline-none min-h-[200px] text-foreground [&_h1]:text-4xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:mb-2 [&_h4]:text-xl [&_h4]:font-bold [&_h4]:mb-2 [&_h5]:text-lg [&_h5]:font-bold [&_h5]:mb-1 [&_h6]:text-base [&_h6]:font-bold [&_h6]:mb-1 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline',
      },
    },
  })

  return <EditorContent editor={editor} className={classes.content} />
}

const useStyles = createStyles((theme, _, u) => ({
  content: css`
    border: ${theme.colors.gray[4]} 1px solid;
    border-radius: ${theme.radius.sm};
    padding: 0 ${theme.spacing.md};
    background-color: ${u.light ? theme.white : theme.colors.dark[7]};
  `,
}))
