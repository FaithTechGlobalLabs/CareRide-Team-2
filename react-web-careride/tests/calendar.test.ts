import assert from "node:assert/strict"
import test from "node:test"
import {
  buildRideCalendar,
  calendarEditorLinks,
  calendarRides,
  shareableCalendarFile,
} from "../src/features/careride/calendar.ts"
import type { Ride } from "../src/features/careride/types.ts"

const now = new Date("2026-10-04T20:00:00Z")
function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: "outbound",
    client_id: "private-client-id",
    round_trip: false,
    pickup_address: "228 W. 5th Ave, Vancouver",
    pickup_lat: 49.2665,
    pickup_lng: -123.1128,
    destination_address: "1081 Burrard St, Vancouver",
    requested_pickup_at: "2026-10-05T09:30:00-07:00",
    duration_minutes: 30,
    passenger_count: 1,
    driver_id: "driver-1",
    status: "accepted",
    created_at: now.toISOString(),
    notes: "Private medical notes",
    accessibility_needs: "Private accommodation",
    client_name: "Private client name",
    ...overrides,
  }
}
function unfolded(calendar: string) {
  return calendar.replace(/\r\n /g, "")
}

test("single ride exports a private event with UTC times, route and ride link", () => {
  const calendar = unfolded(
    buildRideCalendar([ride()], "https://careride.example", now)
  )
  assert.ok(calendar.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"))
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"))
  assert.equal(calendar.match(/BEGIN:VEVENT/g)?.length, 1)
  assert.ok(calendar.includes("DTSTART:20261005T163000Z\r\n"))
  assert.ok(calendar.includes("DTEND:20261005T170000Z\r\n"))
  assert.ok(calendar.includes("CLASS:PRIVATE\r\n"))
  assert.ok(calendar.includes("LOCATION:228 W. 5th Ave\\, Vancouver"))
  assert.ok(calendar.includes("Destination: 1081 Burrard St\\, Vancouver"))
  assert.ok(calendar.includes("URL:https://careride.example/rides/outbound"))
  assert.ok(calendar.includes("delete this event manually"))
  for (const secret of [
    "private-client-id",
    "Private medical notes",
    "Private accommodation",
    "Private client name",
  ]) {
    assert.ok(!calendar.includes(secret))
  }
})

test("round trip includes only accepted legs assigned to this driver", () => {
  const outbound = ride({ linked_ride_id: "return", trip_leg: "outbound" })
  const back = ride({
    id: "return",
    linked_ride_id: "outbound",
    trip_leg: "return",
    requested_pickup_at: "2026-10-05T11:00:00-07:00",
  })
  const selected = calendarRides(back, [outbound, back], "driver-1")
  assert.deepEqual(
    selected.map((item) => item.id),
    ["outbound", "return"]
  )
  const calendar = unfolded(
    buildRideCalendar(selected, "https://careride.example", now)
  )
  assert.equal(calendar.match(/BEGIN:VEVENT/g)?.length, 2)
  assert.ok(calendar.includes("SUMMARY:CareRide outbound pickup"))
  assert.ok(calendar.includes("SUMMARY:CareRide return pickup"))
  assert.ok(calendar.includes("UID:ride-outbound@careride"))
  assert.ok(calendar.includes("UID:ride-return@careride"))
  for (const other of [
    { ...back, status: "requested" as const },
    { ...back, status: "cancelled" as const },
    { ...back, status: "completed" as const },
    { ...back, driver_id: "other-driver" },
  ]) {
    assert.deepEqual(calendarRides(outbound, [other], "driver-1"), [outbound])
  }
  assert.deepEqual(calendarRides(outbound, [back], "other-driver"), [])
  for (const status of [
    "requested",
    "in_progress",
    "completed",
    "cancelled",
    "no_show",
  ] as const) {
    assert.deepEqual(
      calendarRides({ ...outbound, status }, [back], "driver-1"),
      []
    )
  }
})

test("summer and winter offsets preserve the pickup instant and fallback duration", () => {
  for (const [pickup, expected] of [
    ["2026-07-05T09:30:00-07:00", "20260705T163000Z"],
    ["2026-12-05T09:30:00-08:00", "20261205T173000Z"],
  ]) {
    const calendar = unfolded(
      buildRideCalendar(
        [ride({ requested_pickup_at: pickup })],
        "https://careride.example",
        now
      )
    )
    assert.ok(calendar.includes(`DTSTART:${expected}`))
  }
  for (const duration of [undefined, 0, -1, NaN, Infinity]) {
    const calendar = unfolded(
      buildRideCalendar(
        [ride({ duration_minutes: duration })],
        "https://careride.example",
        now
      )
    )
    assert.ok(calendar.includes("DTEND:20261005T171500Z"))
    assert.ok(calendar.includes("45 minutes\\; actual duration may vary"))
  }
})

test("escapes text injection and folds Unicode lines to at most 75 UTF-8 bytes", () => {
  const address = `Clinic; unit 2, \\ entrance\r\nBEGIN:VEVENT ${"🏥é".repeat(70)}`
  const calendar = buildRideCalendar(
    [ride({ pickup_address: address })],
    "https://careride.example",
    now
  )
  for (const line of calendar.split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).length <= 75)
    assert.ok(!line.includes("�"))
  }
  const contents = unfolded(calendar)
  assert.ok(
    contents.includes(
      "LOCATION:Clinic\\; unit 2\\, \\\\ entrance\\nBEGIN:VEVENT"
    )
  )
  assert.equal(
    contents.split("\r\n").filter((line) => line === "BEGIN:VEVENT").length,
    1
  )
  assert.ok(contents.includes("🏥é".repeat(70)))
})

test("UIDs remain stable across repeat exports and links never carry credentials", () => {
  const first = unfolded(
    buildRideCalendar([ride()], "https://careride.example/?token=secret", now)
  )
  const second = unfolded(
    buildRideCalendar(
      [ride()],
      "https://careride.example",
      new Date(now.getTime() + 1000)
    )
  )
  assert.equal(first.match(/UID:[^\r]+/)?.[0], second.match(/UID:[^\r]+/)?.[0])
  assert.ok(!first.includes("secret"))
})

test("invalid or timezone-less pickup times cannot produce misleading events", () => {
  for (const pickup of ["invalid", "2026-10-05T09:30:00", "2026-10-05"]) {
    assert.throws(
      () =>
        buildRideCalendar(
          [ride({ requested_pickup_at: pickup })],
          "https://careride.example",
          now
        ),
      /invalid pickup time/
    )
  }
  assert.throws(
    () => buildRideCalendar([], "https://careride.example", now),
    /No accepted rides/
  )
})

test("provider editors preserve pickup times, route text and manual-removal guidance", () => {
  const location = "Clinic & entrance #2 + café <side door>"
  const links = calendarEditorLinks(
    ride({ pickup_address: location }),
    "https://careride.example/?token=secret"
  )
  const google = new URL(links.google)
  assert.equal(google.origin, "https://calendar.google.com")
  assert.equal(google.searchParams.get("action"), "TEMPLATE")
  assert.equal(
    google.searchParams.get("dates"),
    "20261005T163000Z/20261005T170000Z"
  )
  assert.equal(google.searchParams.get("ctz"), "America/Vancouver")
  assert.equal(google.searchParams.get("location"), location)
  assert.equal(google.searchParams.get("text"), "CareRide pickup")
  assert.ok(
    google.searchParams.get("details")?.includes("delete this event manually")
  )
  for (const [provider, host] of [
    ["outlook", "https://outlook.live.com"],
    ["office365", "https://outlook.office.com"],
  ] as const) {
    const url = new URL(links[provider])
    assert.equal(url.origin, host)
    assert.equal(url.searchParams.get("startdt"), "2026-10-05T16:30:00.000Z")
    assert.equal(url.searchParams.get("enddt"), "2026-10-05T17:00:00.000Z")
    assert.equal(url.searchParams.get("location"), location)
    assert.ok(url.searchParams.get("body")?.includes("&lt;side door&gt;"))
    assert.ok(url.searchParams.get("body")?.includes("Clinic &amp; entrance"))
  }
  for (const link of Object.values(links)) {
    const decoded = decodeURIComponent(link)
    for (const secret of [
      "token=secret",
      "Private+medical+notes",
      "private-client-id",
      "Private+client+name",
    ]) {
      assert.ok(!decoded.includes(secret))
    }
  }
})

test("each round-trip leg opens its own event editor with its own time and title", () => {
  const outbound = new URL(
    calendarEditorLinks(
      ride({ trip_leg: "outbound" }),
      "https://careride.example"
    ).google
  )
  const back = new URL(
    calendarEditorLinks(
      ride({
        id: "return",
        trip_leg: "return",
        requested_pickup_at: "2026-10-05T11:00:00-07:00",
      }),
      "https://careride.example"
    ).google
  )
  assert.equal(outbound.searchParams.get("text"), "CareRide outbound pickup")
  assert.equal(back.searchParams.get("text"), "CareRide return pickup")
  assert.equal(
    back.searchParams.get("dates"),
    "20261005T180000Z/20261005T183000Z"
  )
  assert.ok(
    back.searchParams
      .get("details")
      ?.includes("https://careride.example/rides/return")
  )
})

test("native file handoff checks exact file support and retains calendar contents", async () => {
  const calendar = buildRideCalendar([ride()], "https://careride.example", now)
  const file = new File([calendar], "ride.ics", { type: "text/calendar" })
  const share = async () => {}
  assert.equal(shareableCalendarFile(file, {}), null)
  assert.equal(shareableCalendarFile(file, { share }), null)
  assert.equal(
    shareableCalendarFile(file, { share, canShare: () => false }),
    null
  )
  assert.equal(
    shareableCalendarFile(file, {
      share,
      canShare: () => {
        throw new TypeError("Unsupported file")
      },
    }),
    null
  )
  assert.equal(
    shareableCalendarFile(file, { share, canShare: () => true }),
    file
  )
  const generic = shareableCalendarFile(file, {
    share,
    canShare: ({ files }) => files?.[0].type === "application/octet-stream",
  })
  assert.ok(generic)
  assert.equal(generic.name, "ride.ics")
  assert.equal(await generic.text(), calendar)
})
