import type { Ride } from "./types"

export function calendarRides(ride: Ride, rides: Ride[], driverId: string) {
  if (ride.driver_id !== driverId || ride.status !== "accepted") return []
  const linked = rides.find(
    (item) =>
      item.id === ride.linked_ride_id &&
      item.id !== ride.id &&
      item.driver_id === driverId &&
      item.status === "accepted"
  )
  return (linked ? [ride, linked] : [ride]).sort(
    (a, b) =>
      new Date(a.requested_pickup_at).getTime() -
      new Date(b.requested_pickup_at).getTime()
  )
}

function text(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}

function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

// iCalendar folds physical lines at 75 UTF-8 octets, including continuation spaces.
function fold(line: string) {
  const encoder = new TextEncoder()
  let current = ""
  let bytes = 0
  const lines: string[] = []
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 75) {
      lines.push(current)
      current = " "
      bytes = 1
    }
    current += char
    bytes += size
  }
  lines.push(current)
  return lines.join("\r\n")
}

export function rideCalendarEvent(ride: Ride, appOrigin: string) {
  const origin = new URL(appOrigin).origin
  const start = new Date(ride.requested_pickup_at)
  if (
    !Number.isFinite(start.getTime()) ||
    !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(ride.requested_pickup_at)
  ) {
    throw new Error(
      "This ride has an invalid pickup time. Refresh and try again."
    )
  }
  const knownDuration =
    ride.duration_minutes != null &&
    Number.isFinite(ride.duration_minutes) &&
    ride.duration_minutes > 0
  const minutes = knownDuration ? ride.duration_minutes! : 45
  const end = new Date(start.getTime() + minutes * 60000)
  if (!Number.isFinite(end.getTime()))
    throw new Error("This ride has an invalid duration. Refresh and try again.")
  const url = `${origin}/rides/${encodeURIComponent(ride.id)}`
  const title =
    ride.trip_leg === "return"
      ? "CareRide return pickup"
      : ride.trip_leg === "outbound"
        ? "CareRide outbound pickup"
        : "CareRide pickup"
  const description = [
    `Pickup: ${ride.pickup_address}`,
    `Destination: ${ride.destination_address}`,
    "Pickup scheduled in America/Vancouver; your calendar displays its local time.",
    knownDuration
      ? `Estimated ride duration: ${minutes} minutes.`
      : "Estimated ride duration: 45 minutes; actual duration may vary.",
    `Latest ride details: ${url}`,
    "This event does not sync with CareRide. If the ride is cancelled or you withdraw, delete this event manually. If details change, update it manually.",
  ].join("\n")
  return { start, end, title, description, location: ride.pickup_address, url }
}

export function calendarEditorLinks(ride: Ride, appOrigin: string) {
  const event = rideCalendarEvent(ride, appOrigin)
  const google = new URL("https://calendar.google.com/calendar/render")
  google.search = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${timestamp(event.start)}/${timestamp(event.end)}`,
    details: event.description,
    location: event.location,
    ctz: "America/Vancouver",
  }).toString()
  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
    // Outlook interprets body as HTML, so route text must not become markup.
    body: event.description
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>"),
    location: event.location,
    allday: "false",
  })
  return {
    google: google.href,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${outlookParams}`,
    office365: `https://outlook.office.com/calendar/0/deeplink/compose?${outlookParams}`,
  }
}

export function shareableCalendarFile(
  file: File,
  target: {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
  }
) {
  if (!target.share || !target.canShare) return null
  // Some native share sheets accept the file extension but reject text/calendar.
  const candidates = [
    file,
    new File([file], file.name, {
      type: "application/octet-stream",
      lastModified: file.lastModified,
    }),
  ]
  for (const candidate of candidates) {
    try {
      if (target.canShare({ files: [candidate] })) return candidate
    } catch {
      // Unsupported file sharing must leave the calendar-file option available.
    }
  }
  return null
}

export function buildRideCalendar(
  rides: Ride[],
  appOrigin: string,
  now = new Date()
) {
  if (!rides.length)
    throw new Error("No accepted rides are available to export.")
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareRide//Driver rides//EN",
    "CALSCALE:GREGORIAN",
  ]
  for (const ride of rides) {
    const event = rideCalendarEvent(ride, appOrigin)
    lines.push(
      "BEGIN:VEVENT",
      `UID:ride-${encodeURIComponent(ride.id)}@careride`,
      `DTSTAMP:${timestamp(now)}`,
      `DTSTART:${timestamp(event.start)}`,
      `DTEND:${timestamp(event.end)}`,
      `SUMMARY:${text(event.title)}`,
      `LOCATION:${text(event.location)}`,
      `DESCRIPTION:${text(event.description)}`,
      `URL:${event.url}`,
      "CLASS:PRIVATE",
      "END:VEVENT"
    )
  }
  lines.push("END:VCALENDAR")
  return `${lines.map(fold).join("\r\n")}\r\n`
}
