const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

export function formatRelativeTime(input: Date | string | number | null | undefined): string {
  if (!input) {
    return ""
  }

  const date = input instanceof Date ? input : new Date(input)
  const time = date.getTime()
  if (!Number.isFinite(time)) {
    return ""
  }

  const diff = Date.now() - time
  if (diff < 0) {
    return "just now"
  }

  if (diff < MINUTE) {
    return "just now"
  }
  if (diff < HOUR) {
    const value = Math.floor(diff / MINUTE)
    return `${value}m`
  }
  if (diff < DAY) {
    const value = Math.floor(diff / HOUR)
    return `${value}h`
  }
  if (diff < WEEK) {
    const value = Math.floor(diff / DAY)
    return `${value}d`
  }
  if (diff < MONTH) {
    const value = Math.floor(diff / WEEK)
    return `${value}w`
  }
  if (diff < YEAR) {
    const value = Math.floor(diff / MONTH)
    return `${value}mo`
  }
  const value = Math.floor(diff / YEAR)
  return `${value}y`
}
