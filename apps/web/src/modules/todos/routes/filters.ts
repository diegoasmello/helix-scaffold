/**
 * The list's `date` filter fields whose column is an instant (`timestamptz`):
 * `toApiFilters()` turns their days into the instants that bound them in the
 * user's time zone. `date` is a calendar day and goes to the API as picked.
 */
export const TODO_INSTANT_FILTERS = ['createdAt'] as const
