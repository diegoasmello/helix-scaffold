export function formatDate(
  date: Date,
  style: 'short' | 'full' | 'long' | 'medium'
): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: style,
  }).format(date)
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  }).format(date)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
