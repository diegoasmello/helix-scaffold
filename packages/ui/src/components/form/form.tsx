import type { UseFormReturnType } from '@mantine/form'
import type { ComponentProps } from 'react'

import { useFormBlocker } from '../../hooks'

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

  useFormBlocker(blockNavigationOnDirty, form.isDirty())

  const handleSubmit = form.onSubmit(
    (values) => {
      form.resetDirty()
      onSubmit(values)
    },
    (errors) => {
      if (focusOnError) {
        // add algum notify de feedback?
        const firstErrorPath = Object.keys(errors)[0]
        form.getInputNode(firstErrorPath)?.focus()
      }
    }
  )

  return (
    <form onSubmit={handleSubmit} noValidate {...rest}>
      {children}
    </form>
  )
}
