import { useId, useRef, useState } from "react"
import { CalendarPlus, ChevronDown, ExternalLink } from "lucide-react"
import {
  buildRideCalendar,
  calendarEditorLinks,
  calendarRides,
  shareableCalendarFile,
} from "./calendar"
import { useCare } from "./context"
import type { Ride } from "./types"
import { ErrorBox } from "./ui"

export function AddToCalendar({ ride }: { ride: Ride }) {
  const { data, session } = useCare()
  const hintId = useId()
  const choicesId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState("")
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState("")
  const rides =
    session?.user.role === "driver"
      ? calendarRides(ride, data.rides, session.user.id)
      : []
  if (!rides.length) return null

  function file() {
    return new File(
      [buildRideCalendar(rides, window.location.origin)],
      `careride-${encodeURIComponent(rides[0].id)}${rides.length > 1 ? "-round-trip" : ""}.ics`,
      { type: "text/calendar;charset=utf-8" }
    )
  }

  function openFile(calendar: File, download: boolean) {
    const url = URL.createObjectURL(calendar)
    const link = document.createElement("a")
    link.href = url
    if (download) link.download = calendar.name
    else {
      link.target = "_blank"
      link.rel = "noopener noreferrer"
    }
    document.body.append(link)
    try {
      link.click()
    } finally {
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
  }

  async function deviceCalendar(download = false) {
    setError("")
    setStatus("")
    try {
      const calendar = file()
      const shareFile = !download && shareableCalendarFile(calendar, navigator)
      if (shareFile) {
        setSharing(true)
        // Invoke during the click gesture; waiting first loses native activation.
        await navigator.share({ files: [shareFile] })
        setStatus(
          "Calendar file handed to your device. Choose a compatible calendar and confirm the events there."
        )
      } else {
        openFile(calendar, download)
        setStatus(
          download
            ? "Calendar file requested. Open it in your calendar app to finish adding the events."
            : "Calendar file opened. Your browser may show a preview or download it. Open it in Apple Calendar or another compatible app and confirm the events."
        )
      }
    } catch (e) {
      // Dismissing the native chooser should not trigger a download or an error.
      if (e instanceof DOMException && e.name === "AbortError") return
      setError(
        "Could not open your device calendar. Choose Google Calendar, Outlook, or Download calendar file below."
      )
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="mt-4 text-sm">
      <button
        ref={trigger}
        type="button"
        className="btn secondary"
        aria-describedby={hintId}
        aria-expanded={open}
        aria-controls={choicesId}
        onClick={() => setOpen(!open)}
      >
        <CalendarPlus size={18} aria-hidden="true" />
        {rides.length > 1 ? "Add round trip to calendar" : "Add to Calendar"}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <p id={hintId} className="muted">
        {rides.length > 1
          ? "Includes your accepted outbound and return rides as two events. "
          : ride.linked_ride_id
            ? "Includes this accepted leg only. The other leg is not currently accepted by you. "
            : "Includes this accepted ride. "}
        Choose your calendar, then confirm and save there. Duration is
        estimated, using 45 minutes when unavailable.
      </p>
      {open && (
        <div
          id={choicesId}
          role="region"
          aria-label="Calendar options"
          className="flex min-w-0 flex-col gap-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false)
              trigger.current?.focus()
            }
          }}
        >
          <div>
            <h3>Choose a calendar</h3>
            {rides.length > 1 && (
              <p className="muted">
                Save each leg separately in Google or Outlook. The device
                calendar file includes both legs.
              </p>
            )}
            {rides.map((item) => (
              <CalendarEventLinks
                key={item.id}
                ride={item}
                multiple={rides.length > 1}
              />
            ))}
          </div>
          <div>
            <div className="action-row">
              <button
                type="button"
                className="btn secondary"
                disabled={sharing}
                onClick={() => void deviceCalendar()}
              >
                Apple / device calendar
              </button>
              <button
                type="button"
                className="btn subtle"
                disabled={sharing}
                onClick={() => void deviceCalendar(true)}
              >
                Download calendar file
              </button>
            </div>
            <p className="muted">
              Uses your device’s chooser when supported. Otherwise, open the
              calendar file in your preferred app. Availability depends on your
              browser and installed apps.
            </p>
          </div>
        </div>
      )}
      <p className="muted">
        Calendar events do not sync. If a ride is cancelled or you withdraw,
        delete that event manually. Adding again may create duplicates.
      </p>
      {status && (
        <p role="status" className="info-box">
          {status}
        </p>
      )}
      <ErrorBox error={error} />
    </div>
  )
}

function CalendarEventLinks({
  ride,
  multiple,
}: {
  ride: Ride
  multiple: boolean
}) {
  let links: ReturnType<typeof calendarEditorLinks> | undefined
  let error = ""
  try {
    links = calendarEditorLinks(ride, window.location.origin)
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Unable to open this ride in a calendar."
  }
  if (!links) return <ErrorBox error={error} />
  const label = ride.trip_leg === "return" ? "Return" : "Outbound"
  return (
    <div className="mt-3">
      {multiple && <p className="muted">{label} pickup</p>}
      <div className="action-row">
        {(
          [
            ["google", "Google Calendar"],
            ["outlook", "Outlook.com"],
            ["office365", "Microsoft 365"],
          ] as const
        ).map(([provider, title]) => (
          <a
            key={provider}
            className="btn secondary"
            href={links[provider]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${title}${multiple ? ` — ${label.toLowerCase()} pickup` : ""} (opens in a new tab)`}
          >
            {title} <ExternalLink size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </div>
  )
}
