import i18n from '../i18n'

export function formatDate(
  date: Date,
  style: 'short' | 'full' | 'long' | 'medium'
): string {
  return new Intl.DateTimeFormat(i18n.language, {
    dateStyle: style,
  }).format(date)
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(i18n.language, {
    timeStyle: 'short',
  }).format(date)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
