import type { ReactNode, FormEvent } from "react"
import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  Check,
  HeartHandshake,
  Plus,
  Search,
  X,
} from "lucide-react"
import { useCare } from "./context"
import { relativeDateLabel, vancouverYmd } from "./dates"
import { formatKm, useDriveTimes } from "./travel"
import type { Destination, Ride, Status, Verification } from "./types"

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <HeartHandshake size={23} strokeWidth={1.8} />
      </span>
      CareRide<span className="brand-dot">.</span>
    </span>
  )
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description: string | React.ReactNode
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title?: string
  description?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string
  children: ReactNode
  hint?: string
  wide?: boolean
}) {
  return (
    <label className={`field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <HeartHandshake size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function ErrorBox({ error }: { error?: string }) {
  return error ? (
    <div className="error-box" role="alert">
      {error}
    </div>
  ) : null
}
export function Form({
  children,
  onSubmit,
  submit = "Save",
  footer,
}: {
  children: ReactNode
  onSubmit: (data: FormData) => Promise<void>
  submit?: string
  footer?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const body = new FormData(e.currentTarget)
    setBusy(true)
    setError("")
    try {
      await onSubmit(body)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={handle}>
      <fieldset disabled={busy}>
        <div className="form-grid">{children}</div>
        <ErrorBox error={error} />
        <div className="form-footer">
          {footer}
          <button className="btn primary" type="submit">
            {busy ? "Saving…" : submit}
            {!busy && <ArrowRight size={17} />}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
const labels: Record<Status, string> = {
  requested: "Awaiting driver",
  accepted: "Driver assigned",
  in_progress: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
}
export function Badge({
  status,
}: {
  status: Status | "approved" | "pending" | "rejected" | "expired"
}) {
  return (
    <span className={`badge ${status}`}>
      <span />
      {status in labels ? labels[status as Status] : status.replace(/_/g, " ")}
    </span>
  )
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Vancouver",
  }).format(new Date(value))
}
export function placeLabel(
  ride: Ride,
  kind: "pickup" | "destination",
  destinations: Destination[]
) {
  const named = kind === "pickup" ? ride.pickup_name : ride.destination_name
  if (named) return named
  const id = kind === "pickup" ? ride.pickup_id : ride.destination_id
  const address =
    kind === "pickup" ? ride.pickup_address : ride.destination_address
  const match = destinations.find(
    (destination) =>
      (id && destination.id === id) ||
      (address && destination.address === address)
  )
  return match?.name || address || "Location"
}

export function passengerName(
  ride: Ride,
  client: { first_name?: string; last_name?: string } | undefined,
  driver: boolean
) {
  if (driver) {
    return (
      client?.first_name ||
      ride.client_name?.split(" ")[0] ||
      `${ride.passenger_count} passenger${ride.passenger_count > 1 ? "s" : ""}`
    )
  }
  if (client?.first_name) {
    return [client.first_name, client.last_name].filter(Boolean).join(" ")
  }
  return ride.client_name || "Client ride"
}

export function RideList({
  rides,
  driver = false,
  hideStatuses = [],
}: {
  rides: Ride[]
  driver?: boolean
  hideStatuses?: Status[]
}) {
  const { data } = useCare()
  const driveTimes = useDriveTimes(driver ? rides : [], data.destinations)
  return (
    <div className="ride-list">
      {rides.map((ride) => {
        const client =
          ride.client ?? data.clients.find((c) => c.id === ride.client_id)
        const pickup = placeLabel(ride, "pickup", data.destinations)
        const destination = placeLabel(ride, "destination", data.destinations)
        return (
          <Link
            key={ride.id}
            to="/rides/$rideId"
            params={{ rideId: ride.id }}
            className="ride-row"
          >
            <div className="ride-date">
              <strong>
                {new Date(ride.requested_pickup_at).toLocaleDateString(
                  "en-CA",
                  { day: "numeric", timeZone: "America/Vancouver" }
                )}
              </strong>
              <span>
                {new Date(ride.requested_pickup_at).toLocaleDateString(
                  "en-CA",
                  { month: "short", timeZone: "America/Vancouver" }
                )}
              </span>
            </div>
            <div className="ride-main">
              <strong>
                {passengerName(ride, client, driver)}
                {ride.sample && <small className="sample-tag">Sample</small>}
              </strong>
              <span>
                {dateTime(ride.requested_pickup_at)} · {ride.passenger_count}{" "}
                passenger{ride.passenger_count > 1 ? "s" : ""}
                {driveTimes[ride.id]
                  ? ` · ${driveTimes[ride.id].minutes} min · ${formatKm(driveTimes[ride.id].kilometers)}`
                  : ""}
              </span>
              <div className="route-line">
                {pickup}
                <ArrowRight size={13} />
                {destination}
              </div>
            </div>
            {!hideStatuses.includes(ride.status) && (
              <Badge status={ride.status} />
            )}
            <ArrowRight className="row-arrow" size={18} />
          </Link>
        )
      })}
    </div>
  )
}

export function GroupedRideList({
  rides,
  driver = false,
  hideStatuses = [],
}: {
  rides: Ride[]
  driver?: boolean
  hideStatuses?: Status[]
}) {
  const groups = new Map<string, { label: string; rides: Ride[] }>()
  ;[...rides]
    .sort((a, b) => a.requested_pickup_at.localeCompare(b.requested_pickup_at))
    .forEach((ride) => {
      const key = vancouverYmd(new Date(ride.requested_pickup_at))
      const group = groups.get(key) ?? {
        label: relativeDateLabel(ride.requested_pickup_at),
        rides: [],
      }
      group.rides.push(ride)
      groups.set(key, group)
    })
  return (
    <div className="ride-groups">
      {[...groups.entries()].map(([key, group]) => (
        <section key={key} className="ride-group">
          <h3 className="ride-group-label">{group.label}</h3>
          <RideList rides={group.rides} driver={driver} hideStatuses={hideStatuses} />
        </section>
      ))}
    </div>
  )
}
export function RideSearch({
  rides,
  driver,
}: {
  rides: Ride[]
  driver?: boolean
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const { data } = useCare()
  const filtered = rides.filter((r) => {
    const client = data.clients.find((c) => c.id === r.client_id)
    return (
      (filter === "all" || r.status === filter) &&
      `${client?.first_name ?? ""} ${client?.last_name ?? ""} ${r.client_name ?? ""} ${placeLabel(r, "pickup", data.destinations)} ${placeLabel(r, "destination", data.destinations)} ${r.pickup_address} ${r.destination_address}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
  })
  return (
    <>
      <div className="filter-bar">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Search bookings"
            placeholder="Search client or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Booking status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {Object.entries(labels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {filtered.length ? (
        <RideList rides={filtered} driver={driver} />
      ) : (
        <Empty
          title="No rides to show"
          description="Try another search or book a ride to get started."
        />
      )}
    </>
  )
}
export function ActionButton({
  onClick,
  children,
  className = "secondary",
}: {
  onClick: () => Promise<unknown>
  children: ReactNode
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <div>
      <button
        type="button"
        className={`btn ${className}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError("")
          try {
            await onClick()
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Unable to complete action."
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? "Please wait…" : children}
      </button>
      <ErrorBox error={error} />
    </div>
  )
}
export function ReasonAction({
  title,
  onSubmit,
}: {
  title: string
  onSubmit: (reason: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="reason-action">
      {!open ? (
        <button className="btn subtle" onClick={() => setOpen(true)}>
          {title}
        </button>
      ) : (
        <div className="reason-panel">
          <div className="section-line">
            <h3>{title}</h3>
            <button
              className="icon-button"
              aria-label="Close reason form"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <Form
            submit={title}
            onSubmit={async (f) => {
              await onSubmit(String(f.get("reason")))
              setOpen(false)
            }}
          >
            <Field label="Reason" wide>
              <textarea
                name="reason"
                required
                maxLength={500}
                placeholder="Tell us what happened…"
              />
            </Field>
          </Form>
        </div>
      )}
    </div>
  )
}
export function AddLink({
  to,
  children,
}: {
  to: "/book" | "/clients/new" | "/locations/new"
  children: ReactNode
}) {
  return (
    <Link to={to} className="btn primary">
      <Plus size={18} />
      {children}
    </Link>
  )
}
export function ReviewNote({ record }: { record: Verification }) {
  if (!record.reviewed_by_name && !record.reviewed_at) return null
  const action =
    record.status === "approved"
      ? "Approved"
      : record.status === "rejected"
        ? "Rejected"
        : "Reviewed"
  return (
    <p className="muted">
      {action}
      {record.reviewed_by_name ? ` by ${record.reviewed_by_name}` : ""}
      {record.reviewed_at ? ` · ${dateTime(record.reviewed_at)}` : ""}
    </p>
  )
}
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="success-box" role="status">
      <Check size={18} />
      {children}
    </div>
  )
}
