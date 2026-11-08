// Scheduled system close. Times are "HH:MM" (or "HH:MM:SS" from Postgres)
// in Philippine time, so the schedule doesn't depend on the device's timezone.
export const SYSTEM_TIMEZONE = 'Asia/Manila'

export const DEFAULT_CLOSE_START = '19:00'
export const DEFAULT_CLOSE_END = '07:00'

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// "19:00:00" -> "19:00", for <input type="time">
export const toHHMM = (time?: string | null) => (time ?? '').slice(0, 5)

export function nowMinutesInSystemTz(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SYSTEM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now)
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

// Whether `now` falls in [start, end). Handles ranges that cross midnight.
export function isWithinCloseSchedule(
  start: string,
  end: string,
  now = new Date()
): boolean {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s === e) return false
  const n = nowMinutesInSystemTz(now)
  return s < e ? n >= s && n < e : n >= s || n < e
}

// "19:00" -> "7:00 PM"
export function formatTime12h(time: string): string {
  const total = toMinutes(time)
  const h = Math.floor(total / 60)
  const m = total % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}
