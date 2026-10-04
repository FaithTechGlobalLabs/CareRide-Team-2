import { useId, useState } from "react"
import { CalendarPlus } from "lucide-react"
import { buildRideCalendar, calendarRides } from "./calendar"
import { useCare } from "./context"
import type { Ride } from "./types"
import { ErrorBox } from "./ui"

export function AddToCalendar({ ride }: { ride: Ride }) {
  const { data, session } = useCare()
  const hintId = useId()
  const [exported, setExported] = useState(false)
  const [error, setError] = useState("")
  const rides =
    session?.user.role === "driver"
      ? calendarRides(ride, data.rides, session.user.id)
      : []
  if (!rides.length) return null

  function download() {
    setError("")
    try {
      const calendar = buildRideCalendar(rides, window.location.origin)
      const url = URL.createObjectURL(
        new Blob([calendar], { type: "text/calendar;charset=utf-8" })
      )
      const link = document.createElement("a")
      link.href = url
      link.download = `careride-${encodeURIComponent(rides[0].id)}${rides.length > 1 ? "-round-trip" : ""}.ics`
      document.body.append(link)
      try {
        link.click()
        setExported(true)
      } finally {
        link.remove()
        // Give the browser time to open or download the calendar file.
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export this ride.")
    }
  }

  return (
    <div className="mt-4 text-sm">
      <button
        type="button"
        className="btn secondary"
        aria-describedby={hintId}
        onClick={download}
      >
        <CalendarPlus size={18} aria-hidden="true" />
        {rides.length > 1 ? "Add round trip to calendar" : "Add to Calendar"}
      </button>
      <p id={hintId} className="muted">
        {rides.length > 1
          ? "Includes your accepted outbound and return rides as two events. "
          : ride.linked_ride_id
            ? "Includes this accepted leg only. The other leg is not currently accepted by you. "
            : "Includes this accepted ride. "}
        Open the downloaded .ics file in your calendar and save the event
        {rides.length > 1 ? "s" : ""}. Times follow your calendar’s timezone.
        Duration is estimated, using 45 minutes when unavailable.
      </p>
      <p className="muted">
        Calendar events do not sync. If a ride is cancelled or you withdraw,
        delete that event manually. Downloading again may create duplicates.
      </p>
      {exported && (
        <p role="status" className="info-box">
          Calendar file requested. Finish adding it in your calendar app. If it
          only previews on your phone, import the file from a computer. Google
          Calendar imports are available under Settings → Import &amp; export on
          a computer.
        </p>
      )}
      <ErrorBox error={error} />
    </div>
  )
}
