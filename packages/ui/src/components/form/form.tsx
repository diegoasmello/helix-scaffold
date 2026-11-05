import type { UseFormReturnType } from '@mantine/form'
import type { ComponentProps } from 'react'

import { useFormBlocker } from '../../hooks'
import { FormSummaryContext } from './form-summary'

export interface FormProps<Values, TransformedValues = Values> extends Omit<
  ComponentProps<'form'>,
  'onSubmit'
> {
  form: UseFormReturnType<Values, TransformedValues>
  onSubmit: (values: TransformedValues) => void
  focusOnError?: boolean
  blockNavigationOnDirty?: boolean
}

export function Form<Values, TransformedValues = Values>(
  props: Readonly<FormProps<Values, TransformedValues>>
) {
  const {
    children,
    form,
    focusOnError = true,
    blockNavigationOnDirty = true,
    onSubmit,
    ...rest
  } = props

  const dirty = form.isDirty()
  const errorCount = Object.values(form.errors).filter(Boolean).length

  useFormBlocker(blockNavigationOnDirty, dirty)

  const handleSubmit = form.onSubmit(
    (values) => {
      form.resetDirty()
      onSubmit(values)
    },
    (errors) => {
      if (focusOnError) {
        firstInDocumentOrder(
          Object.keys(errors).map((path) => form.getInputNode(path))
        )?.focus()
      }
    }
  )

  return (
    <FormSummaryContext.Provider value={{ dirty, errorCount }}>
      <form onSubmit={handleSubmit} noValidate {...rest}>
        {children}
      </form>
    </FormSummaryContext.Provider>
  )
}

/**
 * The invalid field highest on the screen. The errors come in the order of
 * the `validate` rules, which need not match the fields' order (`content`
 * before `date` while the date sits above the editor). Paths without a
 * `data-path` node (a field that does not forward it) are skipped.
 */
function firstInDocumentOrder(nodes: (HTMLElement | null)[]) {
  return nodes.reduce<HTMLElement | null>((first, node) => {
    if (!node) return first
    if (!first) return node
    return first.compareDocumentPosition(node) &
      Node.DOCUMENT_POSITION_PRECEDING
      ? node
      : first
  }, null)
}
