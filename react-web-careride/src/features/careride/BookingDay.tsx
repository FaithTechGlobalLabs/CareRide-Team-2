import { useEffect, useMemo, useRef, useState } from "react"
import { TIMEZONE, vancouverMinutes, vancouverYmd } from "./dates"
import { Panel } from "./ui"
import {
  cachedTravelTime,
  formatKm,
  geocodeAddress,
  useDriveTimes,
  type LatLng,
  type TravelEstimate,
} from "./travel"
import type { Destination, Ride } from "./types"

const BUFFER_MINUTES = 15
const HOUR_HEIGHT = 64
const START_HOUR = 6
const END_HOUR = 22

function clock(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour >= 12 ? "PM" : "AM"
  const value = hour % 12 || 12
  return `${value}:${String(minute).padStart(2, "0")} ${suffix}`
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM"
  return `${hour % 12 || 12} ${suffix}`
}

async function point(
  lat: number | undefined,
  lng: number | undefined,
  address: string,
  named?: Destination
): Promise<LatLng | null> {
  if (named && Number.isFinite(named.lat) && Number.isFinite(named.lng)) {
    return { lat: named.lat, lng: named.lng }
  }
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng }
  }
  if (!address) return null
  return geocodeAddress(address)
}

export function BookingDayCard({
  ride,
  rides,
  destinations,
}: {
  ride: Ride
  rides: Ride[]
  destinations: Destination[]
}) {
  const day = vancouverYmd(new Date(ride.requested_pickup_at))
  const pickupAt = vancouverMinutes(ride.requested_pickup_at)
  const driveTimes = useDriveTimes(
    [ride, ...rides.filter((item) => item.id !== ride.id)],
    destinations
  )
  const travel = driveTimes[ride.id]
  const [fromHere, setFromHere] = useState<TravelEstimate | null>(null)
  const [fromHereNote, setFromHereNote] = useState("")
  const [locating, setLocating] = useState(false)
  const pickupRef = useRef<LatLng | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const booked = useMemo(() => {
    return rides
      .filter(
        (item) =>
          item.id !== ride.id &&
          ["accepted", "in_progress", "completed"].includes(item.status) &&
          vancouverYmd(new Date(item.requested_pickup_at)) === day
      )
      .map((item) => {
        const start = vancouverMinutes(item.requested_pickup_at)
        const drive = driveTimes[item.id]
        const body = drive?.minutes
          ?? (item.duration_minutes && item.duration_minutes > 0
            ? item.duration_minutes
            : 45)
        return {
          id: item.id,
          start,
          body,
          name: item.client?.first_name || "Booked",
          place: item.destination_name || item.destination_address,
        }
      })
  }, [rides, ride.id, day, driveTimes])

  const body = travel?.minutes ?? ride.duration_minutes ?? 45
  const proposal = {
    start: pickupAt,
    body,
  }
  const nearby = booked.filter(
    (item) =>
      item.start + item.body > proposal.start - BUFFER_MINUTES - 120 &&
      item.start < proposal.start + proposal.body + BUFFER_MINUTES + 120
  )
  const earliest = Math.min(
    proposal.start - BUFFER_MINUTES,
    ...nearby.map((item) => item.start)
  )
  const latest = Math.max(
    proposal.start + proposal.body + BUFFER_MINUTES,
    ...nearby.map((item) => item.start + item.body)
  )
  const windowStart = Math.max(
    START_HOUR * 60,
    Math.floor((earliest - 45) / 60) * 60
  )
  const windowEnd = Math.max(
    windowStart + 60,
    Math.min(END_HOUR * 60, Math.ceil((latest + 45) / 60) * 60)
  )
  const hours = Array.from(
    { length: Math.max(1, (windowEnd - windowStart) / 60) },
    (_, index) => windowStart / 60 + index
  )

  useEffect(() => {
    const root = scroller.current
    const current = root?.querySelector<HTMLElement>(".preview-event.proposed")
    if (!root || !current) return
    root.scrollTop = Math.max(0, current.offsetTop - 36)
  }, [day, windowStart, body])

  useEffect(() => {
    let cancel = false
    const pickupPlace = destinations.find(
      (item) =>
        item.id === ride.pickup_id || item.address === ride.pickup_address
    )
    void (async () => {
      const origin = await point(
        ride.pickup_lat,
        ride.pickup_lng,
        ride.pickup_address,
        pickupPlace
      )
      if (!cancel) pickupRef.current = origin
    })()
    return () => {
      cancel = true
    }
  }, [ride, destinations])

  const locate = () => {
    if (!navigator.geolocation) {
      setFromHereNote("This browser cannot share a location.")
      return
    }
    setLocating(true)
    setFromHere(null)
    setFromHereNote("")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const pickup = pickupRef.current
            if (!pickup) {
              setFromHereNote("Pickup location is not on the map yet.")
              return
            }
            const estimate = await cachedTravelTime(
              {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              },
              pickup
            )
            if (!estimate) {
              setFromHereNote("Could not calculate that drive.")
              return
            }
            setFromHere(estimate)
          } catch {
            setFromHereNote("Could not calculate that drive.")
          } finally {
            setLocating(false)
          }
        })()
      },
      () => {
        setLocating(false)
        setFromHereNote("Location permission was not granted.")
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 }
    )
  }

  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(ride.requested_pickup_at))

  return (
    <Panel title={dateLabel} className="booking-day-card">
      <div className="travel-readout">
        <strong>{travel ? `${travel.minutes} min` : "—"}</strong>
        <span>
          {travel ? formatKm(travel.kilometers) : "Checking drive time…"}
        </span>
        <small>
          Pickup {clock(pickupAt)}
          {travel
            ? ` · arrive about ${clock(pickupAt + travel.minutes)}`
            : ""}
          . The block adds 15 minutes before and after the drive.
        </small>
      </div>
      <div className="booking-day-scroll" ref={scroller}>
        <div
          className="booking-day-grid"
          style={{
            ["--hour-height" as string]: `${HOUR_HEIGHT}px`,
            ["--hour-count" as string]: String(hours.length),
          }}
        >
          <div className="booking-day-times">
            {hours.map((hour) => (
              <span key={hour}>{formatHour(hour)}</span>
            ))}
          </div>
          <div className="booking-day-column">
            {hours.map((hour) => (
              <div key={hour} className="week-hour" />
            ))}
            {nearby.map((item) => (
              <PreviewBlock
                key={item.id}
                start={item.start}
                body={item.body}
                windowStart={windowStart}
                title={item.name}
                detail={item.place}
              />
            ))}
            <PreviewBlock
              proposed
              start={proposal.start}
              body={proposal.body}
              windowStart={windowStart}
              title={travel ? `${travel.minutes} min` : "This ride"}
              detail={
                travel
                  ? `${formatKm(travel.kilometers)} · ${clock(pickupAt)}`
                  : clock(pickupAt)
              }
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="btn secondary"
        onClick={locate}
        disabled={locating}
      >
        {locating ? "Finding your location…" : "See distance from my current location"}
      </button>
      {fromHere && (
        <p className="from-here">
          From your location to the pickup:{" "}
          <strong>
            {fromHere.minutes} min · {formatKm(fromHere.kilometers)}
          </strong>
        </p>
      )}
      {fromHereNote && <p className="from-here">{fromHereNote}</p>}
    </Panel>
  )
}

const MIN_SQUARE = 72

function PreviewBlock({
  start,
  body,
  windowStart,
  title,
  detail,
  proposed,
}: {
  start: number
  body: number
  windowStart: number
  title: string
  detail: string
  proposed?: boolean
}) {
  const total = body + BUFFER_MINUTES * 2
  const top = ((start - BUFFER_MINUTES - windowStart) / 60) * HOUR_HEIGHT
  const height = Math.max(MIN_SQUARE, (total / 60) * HOUR_HEIGHT)
  return (
    <div
      className={`preview-event${proposed ? " proposed" : ""}`}
      style={{ top, height }}
    >
      <span className="drive-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  )
}
