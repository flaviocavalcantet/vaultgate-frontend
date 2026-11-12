const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** A byte count for people: 1,024-based, one decimal from KB up ("3.2 MB"). */
export function formatBytes(bytes: number, locale: string): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 ? 0 : 1
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
  return `${number} ${UNITS[unit]}`
}

/** A date and time in the reader's locale and time zone. */
export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}
