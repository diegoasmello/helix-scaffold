import { createContext, useContext } from 'react'

/** What a surrounding `Form` tells the page around its fields. */
export interface FormSummary {
  /** The values differ from the initial ones (reset on a valid submit). */
  dirty: boolean
  /** Fields currently showing a validation error. */
  errorCount: number
}

export const FormSummaryContext = createContext<FormSummary | null>(null)

/** The surrounding `Form`'s status, or `null` outside a `Form`. */
export function useFormSummary(): FormSummary | null {
  return useContext(FormSummaryContext)
}
