import type { Validator } from './validators'

type CrossFieldValidator<TValue, TValues> = (
  value: TValue,
  values: TValues
) => string | null

type FieldEntry<TValue, TValues> =
  | Validator<TValue>[]
  | CrossFieldValidator<TValue, TValues>

type ValidatorSchema<TValues> = {
  [K in keyof TValues]?: FieldEntry<TValues[K], TValues>
}

type ResolvedSchema<TValues, TSchema extends ValidatorSchema<TValues>> = {
  [K in keyof TSchema]-?: CrossFieldValidator<
    TValues[K & keyof TValues],
    TValues
  >
}

export function createValidator<TValues>() {
  return <TSchema extends ValidatorSchema<TValues>>(
    schema: TSchema
  ): ResolvedSchema<TValues, TSchema> =>
    Object.fromEntries(
      Object.entries(schema).map(([key, entry]) => [
        key,
        Array.isArray(entry)
          ? (value: unknown) =>
              (entry as Validator<unknown>[]).reduce<string | null>(
                (err, fn) => err ?? fn(value),
                null
              )
          : entry,
      ])
    ) as ResolvedSchema<TValues, TSchema>
}
