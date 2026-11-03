/**
 * Widths shared by `FormSection` and `FormColumn`, so a single-column form is
 * as wide as a sectioned one. Internal — not exported from the package.
 */

/** A section's title and description (left column). */
export const FORM_INTRO_MAX_WIDTH = 300

/** Between the intro and the fields. */
export const FORM_COLUMN_GAP = 48

/** A section's fields — wide enough for the `RichTextEditor` toolbar on one row. */
export const FORM_FIELDS_MAX_WIDTH = 800

/** A whole sectioned form, and so a `FormColumn`. */
export const FORM_MAX_WIDTH =
  FORM_INTRO_MAX_WIDTH + FORM_COLUMN_GAP + FORM_FIELDS_MAX_WIDTH
