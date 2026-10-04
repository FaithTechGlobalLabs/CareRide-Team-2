export const TIMEZONE = "America/Vancouver"

export function vancouverYmd(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function addDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, "0")
  const d = String(next.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function relativeDateLabel(iso: string) {
  const key = vancouverYmd(new Date(iso))
  const today = vancouverYmd(new Date())
  if (key === today) return "Today"
  if (key === addDays(today, 1)) return "Tomorrow"
  if (key === addDays(today, -1)) return "Yesterday"
  const [year, month, day] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function vancouverMinutes(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  return (hour === 24 ? 0 : hour) * 60 + minute
}

export function weekdayIndex(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function startOfWeek(ymd: string) {
  const day = weekdayIndex(ymd)
  const delta = day === 0 ? -6 : 1 - day
  return addDays(ymd, delta)
}
