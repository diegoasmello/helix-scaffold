export * from '@helix/ui-real'

export function RichTextEditor(props: {
  label?: string
  value?: string
  onChange?: (v: string) => void
}) {
  const { label, value, onChange } = props
  return (
    <textarea
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}

export function RichTextRenderer(props: { value?: string }) {
  const { value } = props
  return <>{value ?? ''}</>
}
