// eslint-disable-next-line react-refresh/only-export-components
export * from '@helix/ui-real'

export function RichTextEditor(props: {
  label?: string
  value?: string
  onChange?: (v: string) => void
  'data-path'?: string
}) {
  const { label, value, onChange, 'data-path': dataPath } = props
  return (
    <textarea
      aria-label={label}
      data-path={dataPath}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}

export function RichTextRenderer(props: { value?: string }) {
  const { value } = props
  return <>{value ?? ''}</>
}
