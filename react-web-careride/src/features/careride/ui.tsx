import type { ReactNode, FormEvent } from "react"
import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  ArrowLeft,
  Check,
  HeartHandshake,
  Plus,
  Search,
  X,
} from "lucide-react"
import { useCare } from "./context"
import type { Ride, Status } from "./types"

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
    timeZone: "America/Vancouver",
  }).format(new Date(value))
}
export function RideList({
  rides,
  driver = false,
}: {
  rides: Ride[]
  driver?: boolean
}) {
  const { data } = useCare()
  return (
    <div className="ride-list">
      {rides.map((ride) => {
        const client =
          ride.client ?? data.clients.find((c) => c.id === ride.client_id)
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
                {client
                  ? `${client.first_name} ${client.last_name}`
                  : driver
                    ? `${ride.passenger_count} passenger${ride.passenger_count > 1 ? "s" : ""}`
                    : "Client ride"}
                {ride.sample && <small className="sample-tag">Sample</small>}
              </strong>
              <span>
                {dateTime(ride.requested_pickup_at)} · {ride.passenger_count}{" "}
                passenger{ride.passenger_count > 1 ? "s" : ""}
              </span>
              <div className="route-line">
                {ride.pickup_address}
                <ArrowRight size={13} />
                {ride.destination_address}
              </div>
              { <div className="route-line">
                {ride.pickup_address}
                <ArrowLeft size={13} />
                {ride.destination_address}
              </div>}
            </div>
            <Badge status={ride.status} />
            <ArrowRight className="row-arrow" size={18} />
          </Link>
        )
      })}
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
      `${client?.first_name ?? ""} ${client?.last_name ?? ""} ${r.pickup_address} ${r.destination_address}`
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
export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="success-box" role="status">
      <Check size={18} />
      {children}
    </div>
  )
}
