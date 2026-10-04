import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  TIMEZONE,
  addDays,
  startOfWeek,
  vancouverMinutes,
  vancouverYmd,
  weekdayIndex,
} from "./dates"
import { useCare } from "./context"
import { formatKm, useDriveTimes, type TravelEstimate } from "./travel"
import type { Ride } from "./types"

const START_HOUR = 6
const END_HOUR = 22
const HOUR_HEIGHT = 56
const MIN_EVENT_HEIGHT = 52
const BUFFER_MINUTES = 15
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function rideMinutes(ride: Ride) {
  return ride.duration_minutes && ride.duration_minutes > 0
    ? ride.duration_minutes
    : 45
}

function placeTitle(ride: Ride) {
  return ride.destination_name || ride.destination_address
}

function passenger(ride: Ride) {
  return ride.client?.first_name || "Passenger"
}

export function WeekCalendar({
  rides,
  driveTimes,
}: {
  rides: Ride[]
  driveTimes?: Record<string, TravelEstimate>
}) {
  const today = vancouverYmd(new Date())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  )
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, index) => START_HOUR + index
  )
  const nowMinutes = vancouverMinutes(new Date().toISOString())
  const showNow =
    days.includes(today) &&
    nowMinutes >= START_HOUR * 60 &&
    nowMinutes <= END_HOUR * 60
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = scrollRef.current
    const current = root?.querySelector<HTMLElement>(".week-day.today")
    if (!root || !current) return
    root.scrollLeft = Math.max(
      0,
      current.offsetLeft - root.clientWidth / 2 + current.clientWidth / 2
    )
  }, [weekStart])

  const byDay = useMemo(() => {
    const committed = rides.filter((ride) =>
      ["accepted", "in_progress", "completed"].includes(ride.status)
    )
    return days.map((day) => {
      const events = committed
        .filter(
          (ride) => vancouverYmd(new Date(ride.requested_pickup_at)) === day
        )
        .map((ride) => {
          const pickup = vancouverMinutes(ride.requested_pickup_at)
          const drive = driveTimes?.[ride.id]
          const timed = driveTimes != null
          const body = drive?.minutes ?? rideMinutes(ride)
          const start = timed ? pickup - BUFFER_MINUTES : pickup
          const end = Math.min(pickup + body + BUFFER_MINUTES, END_HOUR * 60)
          return { ride, start, end, body, drive, timed }
        })
        .filter(
          (event) => event.end > START_HOUR * 60 && event.start < END_HOUR * 60
        )
        .sort((a, b) => a.start - b.start || a.end - b.end)
      return layout(events)
    })
  }, [rides, days, driveTimes])

  return (
    <div className="week-calendar">
      <div className="week-toolbar">
        <div className="action-row">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous week"
            onClick={() => setWeekStart((value) => addDays(value, -7))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn subtle"
            onClick={() => setWeekStart(startOfWeek(today))}
          >
            This week
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next week"
            onClick={() => setWeekStart((value) => addDays(value, 7))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p>
          {formatRange(days[0], days[6])} · {TIMEZONE.replace("_", " ")}
        </p>
      </div>
      <div className="week-scroll" ref={scrollRef}>
        <div
          className="week-grid"
          style={{
            ["--hour-height" as string]: `${HOUR_HEIGHT}px`,
            ["--hour-count" as string]: String(END_HOUR - START_HOUR),
          }}
        >
          <div className="week-corner" />
          {days.map((day) => {
            const date = Number(day.slice(-2))
            return (
              <div
                key={day}
                className={`week-day-label ${day === today ? "today" : ""}`}
              >
                <span>{WEEKDAYS[(weekdayIndex(day) + 6) % 7]}</span>
                <strong>{date}</strong>
              </div>
            )
          })}
          <div className="week-times">
            {hours.map((hour) => (
              <span key={hour}>{formatHour(hour)}</span>
            ))}
          </div>
          {days.map((day, index) => (
            <div
              key={day}
              className={`week-day ${day === today ? "today" : ""}`}
            >
              {hours.map((hour) => (
                <div key={hour} className="week-hour" />
              ))}
              {showNow && day === today && (
                <div
                  className="week-now"
                  style={{
                    top: ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                  }}
                />
              )}
              {byDay[index].map((event) => {
                const top = Math.max(
                  0,
                  ((event.start - START_HOUR * 60) / 60) * HOUR_HEIGHT
                )
                const span =
                  ((event.end - Math.max(event.start, START_HOUR * 60)) / 60) *
                  HOUR_HEIGHT
                const height = event.timed
                  ? Math.max(40, span)
                  : Math.max(MIN_EVENT_HEIGHT, span)
                return (
                  <Link
                    key={event.ride.id}
                    to="/rides/$rideId"
                    params={{ rideId: event.ride.id }}
                    className={`cal-event ${event.ride.status}${event.timed ? "timed" : ""}`}
                    style={{
                      top,
                      height,
                      left: `calc(${(event.col / event.cols) * 100}% + 3px)`,
                      width: `calc(${100 / event.cols}% - 6px)`,
                    }}
                    aria-label={eventLabel(event.ride, event.drive)}
                  >
                    <span className="cal-event-body">
                      <strong>{passenger(event.ride)}</strong>
                      {event.drive && (
                        <small>
                          {event.drive.minutes} min ·{" "}
                          {formatKm(event.drive.kilometers)}
                        </small>
                      )}
                      <small>{placeTitle(event.ride)}</small>
                    </span>
                    {!event.timed && height > 68 && (
                      <span className="cal-event-pad">
                        {BUFFER_MINUTES} min buffer
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="map-hint">
        {driveTimes
          ? `Each block is the drive plus ${BUFFER_MINUTES} minutes before and after.`
          : `Solid time is the ride. The lighter band is a ${BUFFER_MINUTES}-minute buffer so you can see whether another pickup fits.`}
      </p>
    </div>
  )
}

function layout<T extends { start: number; end: number }>(events: T[]) {
  const clusters: T[][] = []
  let cluster: T[] = []
  let clusterEnd = -1
  for (const event of events) {
    if (!cluster.length || event.start < clusterEnd) {
      cluster.push(event)
      clusterEnd = Math.max(clusterEnd, event.end)
    } else {
      clusters.push(cluster)
      cluster = [event]
      clusterEnd = event.end
    }
  }
  if (cluster.length) clusters.push(cluster)
  return clusters.flatMap((group) => {
    const columnEnds: number[] = []
    const placed = group.map((event) => {
      let col = columnEnds.findIndex((end) => end <= event.start)
      if (col < 0) {
        col = columnEnds.length
        columnEnds.push(event.end)
      } else columnEnds[col] = event.end
      return { ...event, col }
    })
    return placed.map((event) => ({ ...event, cols: columnEnds.length }))
  })
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM"
  const value = hour % 12 || 12
  return `${value} ${suffix}`
}

const VISIBLE = ["requested", "accepted", "in_progress", "completed"]

export function TodayColumn({ rides }: { rides: Ride[] }) {
  const { data } = useCare()
  const today = vancouverYmd(new Date())
  const todays = rides.filter(
    (ride) =>
      ["accepted", "in_progress", "completed"].includes(ride.status) &&
      vancouverYmd(new Date(ride.requested_pickup_at)) === today
  )
  const driveTimes = useDriveTimes(todays, data.destinations)
  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, index) => START_HOUR + index
  )
  const nowMinutes = vancouverMinutes(new Date().toISOString())
  const showNow = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60
  const scrollRef = useRef<HTMLDivElement>(null)
  const events = useMemo(() => {
    const placed = todays
      .map((ride) => {
        const pickup = vancouverMinutes(ride.requested_pickup_at)
        const drive = driveTimes[ride.id]
        const body = drive?.minutes ?? rideMinutes(ride)
        const start = pickup - BUFFER_MINUTES
        const end = Math.min(pickup + body + BUFFER_MINUTES, END_HOUR * 60)
        return { ride, start, end, body, drive, timed: true as const }
      })
      .filter((event) => event.end > START_HOUR * 60 && event.start < END_HOUR * 60)
      .sort((a, b) => a.start - b.start || a.end - b.end)
    return layout(placed)
  }, [todays, driveTimes])

  useEffect(() => {
    const root = scrollRef.current
    const marker = root?.querySelector<HTMLElement>(".cal-event")
    if (!root || !marker) return
    root.scrollTop = Math.max(0, marker.offsetTop - 28)
  }, [events.length])

  if (!todays.length) {
    return (
      <div className="today-clear">
        <strong>A clear day.</strong>
        <p>Nothing is booked today. The afternoon is yours.</p>
      </div>
    )
  }

  return (
    <div className="today-column">
      <div className="week-scroll" ref={scrollRef}>
        <div
          className="today-grid"
          style={{
            ["--hour-height" as string]: `${HOUR_HEIGHT}px`,
            ["--hour-count" as string]: String(END_HOUR - START_HOUR),
          }}
        >
          <div className="week-times">
            {hours.map((hour) => (
              <span key={hour}>{formatHour(hour)}</span>
            ))}
          </div>
          <div className="week-day today">
            {hours.map((hour) => (
              <div key={hour} className="week-hour" />
            ))}
            {showNow && (
              <div
                className="week-now"
                style={{
                  top: ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT,
                }}
              />
            )}
            {events.map((event) => {
              const top = Math.max(
                0,
                ((event.start - START_HOUR * 60) / 60) * HOUR_HEIGHT
              )
              const height = Math.max(
                40,
                ((event.end - Math.max(event.start, START_HOUR * 60)) / 60) *
                  HOUR_HEIGHT
              )
              return (
                <Link
                  key={event.ride.id}
                  to="/rides/$rideId"
                  params={{ rideId: event.ride.id }}
                  className={`cal-event timed ${event.ride.status}`}
                  style={{ top, height, left: 4, right: 4, width: "auto" }}
                >
                  <span className="cal-event-body">
                    <strong>{passenger(event.ride)}</strong>
                    {event.drive && (
                      <small>
                        {event.drive.minutes} min · {formatKm(event.drive.kilometers)}
                      </small>
                    )}
                    <small>{placeTitle(event.ride)}</small>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}


export function RideSchedule({
  rides,
  driver = false,
}: {
  rides: Ride[]
  driver?: boolean
}) {
  const { data } = useCare()
  const [view, setView] = useState<"week" | "month">("week")
  const visible = rides.filter((ride) => VISIBLE.includes(ride.status))
  const driveTimes = useDriveTimes(driver ? visible : [], data.destinations)
  return (
    <div className="schedule">
      <div className="view-tabs" role="tablist" aria-label="Calendar view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "week"}
          className={view === "week" ? "active" : ""}
          onClick={() => setView("week")}
        >
          Week
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "month"}
          className={view === "month" ? "active" : ""}
          onClick={() => setView("month")}
        >
          Month
        </button>
      </div>
      {view === "week" ? (
        <WeekCalendar
          rides={visible}
          driveTimes={driver ? driveTimes : undefined}
        />
      ) : (
        <MonthCalendar
          rides={visible}
          driveTimes={driver ? driveTimes : undefined}
        />
      )}
    </div>
  )
}

function eventLabel(ride: Ride, drive?: TravelEstimate) {
  const when = new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(ride.requested_pickup_at))
  const time = drive
    ? `${drive.minutes} minute drive plus ${BUFFER_MINUTES} minutes before and after.`
    : `Includes a ${BUFFER_MINUTES} minute buffer after the ride.`
  return `${passenger(ride)} to ${placeTitle(ride)} at ${when}. ${time}`
}

function MonthCalendar({
  rides,
  driveTimes,
}: {
  rides: Ride[]
  driveTimes?: Record<string, TravelEstimate>
}) {
  const today = vancouverYmd(new Date())
  const [cursor, setCursor] = useState(today.slice(0, 7))
  const cells = useMemo(() => monthCells(cursor), [cursor])
  const label = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${cursor}-15T12:00:00Z`))

  return (
    <div className="month-calendar">
      <div className="week-toolbar">
        <div className="action-row">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            onClick={() => setCursor((value) => shiftMonth(value, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn subtle"
            onClick={() => setCursor(today.slice(0, 7))}
          >
            This month
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => setCursor((value) => shiftMonth(value, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p>
          {label} · {TIMEZONE.replace("_", " ")}
        </p>
      </div>
      <div className="month-grid">
        {WEEKDAYS.map((day) => (
          <div key={day} className="month-weekday">
            {day}
          </div>
        ))}
        {cells.map((day) => {
          const items = rides
            .filter(
              (ride) => vancouverYmd(new Date(ride.requested_pickup_at)) === day
            )
            .sort((a, b) =>
              a.requested_pickup_at.localeCompare(b.requested_pickup_at)
            )
          return (
            <div
              key={day}
              className={`month-cell ${day === today ? "today" : ""} ${day.slice(0, 7) === cursor ? "" : "outside"}`}
            >
              <strong>{Number(day.slice(-2))}</strong>
              <div className="month-events">
                {items.map((ride) => (
                  <Link
                    key={ride.id}
                    to="/rides/$rideId"
                    params={{ rideId: ride.id }}
                    className={`month-chip ${ride.status}`}
                  >
                    {new Intl.DateTimeFormat("en-CA", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: TIMEZONE,
                    }).format(new Date(ride.requested_pickup_at))}{" "}
                    {passenger(ride)}
                    {driveTimes?.[ride.id]
                      ? ` · ${driveTimes[ride.id].minutes} min`
                      : ""}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function monthCells(yearMonth: string) {
  const first = `${yearMonth}-01`
  const firstWeekday = weekdayIndex(first)
  const lead = firstWeekday === 0 ? 6 : firstWeekday - 1
  const start = addDays(first, -lead)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function shiftMonth(yearMonth: string, delta: number) {
  const [year, month] = yearMonth.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1 + delta, 1))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function formatRange(start: string, end: string) {
  const label = (ymd: string) => {
    const [year, month, day] = ymd.split("-").map(Number)
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  }
  return `${label(start)} – ${label(end)}`
}
