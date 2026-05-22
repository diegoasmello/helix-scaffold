import { msg } from './validator-messages'

export type Validator<T = string> = (value: T) => string | null

export const required: Validator<unknown> = (v) =>
  !v || (typeof v === 'string' && !v.trim()) ? msg.required : null

export const maxLength = (max: number): Validator<string> => (v) =>
  v.length > max ? msg.maxLength(max) : null

export const minLength = (min: number): Validator<string> => (v) =>
  v.length < min ? msg.minLength(min) : null

export const requiredHtml: Validator<string> = (v) =>
  !v.replace(/<[^>]*>/g, '').trim() ? msg.required : null

export const email: Validator<string> = (v) =>
  v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? msg.email : null

export const rules =
  <T>(...validators: Validator<T>[]): Validator<T> =>
  (value) =>
    validators.reduce<string | null>((err, fn) => err ?? fn(value), null)
