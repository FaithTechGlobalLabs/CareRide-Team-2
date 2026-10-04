import { useState } from "react"
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Pause,
  Pencil,
  Play,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useCare } from "./context"
import { formatClockTime } from "./dates"
import { Layout } from "./Layout"
import { PinMap } from "./MapPin"
import {
  ActionButton,
  Badge,
  Empty,
  Field,
  Form,
  PageTitle,
  Panel,
  ReviewNote,
  Success,
} from "./ui"
import type { Availability } from "./types"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function DriverAvailabilityScreen() {
  const { data, mutate, session } = useCare()
  const [showForm, setShowForm] = useState(false)
  const [pin, setPin] = useState({ lat: 49.2665, lng: -123.1128 })
  const [radius, setRadius] = useState(25)
  const [kind, setKind] = useState<"one_time" | "weekly" | "monthly">("weekly")
  const [editing, setEditing] = useState<Availability | null>(null)
  const [success, setSuccess] = useState("")
  const openNew = () => {
    setEditing(null)
    setKind("weekly")
    setPin({ lat: 49.2665, lng: -123.1128 })
    setRadius(25)
    setShowForm(true)
  }
  const openEdit = (item: Availability) => {
    setEditing(item)
    setKind(item.kind)
    setPin({ lat: item.centre_lat, lng: item.centre_lng })
    setRadius(item.radius_km)
    setShowForm(true)
  }

  return (
    <Layout driver>
      <PageTitle
        eyebrow="YOUR TIME, YOUR TERMS"
        title="When can you lend a hand?"
        description="Set the schedule, service area, notice, and wait time that work for you."
        action={
          <button
            className="btn primary"
            onClick={() => (showForm ? setShowForm(false) : openNew())}
          >
            <CalendarDays size={18} />{" "}
            {showForm ? "Close form" : "Add availability"}
          </button>
        }
      />
      {success && <Success>{success}</Success>}
      {showForm && (
        <Panel
          title={editing ? "Edit availability" : "New availability"}
          description="Ride requests only appear when every rule below matches."
          className="form-panel"
        >
          <Form
            key={editing?.id ?? "new"}
            submit={editing ? "Save changes" : "Save availability"}
            onSubmit={async (form) => {
              const values = Object.fromEntries(form)
              const body = {
                ...values,
                kind,
                centre_lat: pin.lat,
                centre_lng: pin.lng,
                radius_km: radius,
                minimum_notice_minutes: Number(values.minimum_notice_minutes),
                max_wait_minutes: Number(values.max_wait_minutes),
                weekdays:
                  kind === "weekly"
                    ? form.getAll("weekdays").map(Number)
                    : undefined,
                month_days:
                  kind === "monthly"
                    ? form.getAll("month_days").map(Number)
                    : undefined,
                is_active: editing?.is_active ?? true,
                timezone: "America/Vancouver",
              }
              await mutate<Availability>(
                editing
                  ? `/drivers/me/availability/${editing.id}`
                  : "/drivers/me/availability",
                editing ? "PATCH" : "POST",
                body
              )
              setShowForm(false)
              setEditing(null)
              setSuccess(
                editing
                  ? "Availability updated."
                  : "Availability saved. Matching requests will appear on My rides."
              )
            }}
          >
            <Field label="Schedule type" wide>
              <select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as "one_time" | "weekly" | "monthly")
                }
              >
                <option value="weekly">Weekly schedule</option>
                <option value="monthly">Monthly schedule</option>
                <option value="one_time">One-time availability</option>
              </select>
            </Field>
            {kind === "weekly" ? (
              <div className="wide">
                <h3 className="form-section">Days available</h3>
                <div className="weekday-grid">
                  {WEEKDAYS.map((day, index) => (
                    <label className="weekday" key={day}>
                      <input
                        type="checkbox"
                        name="weekdays"
                        value={index}
                        defaultChecked={
                          editing?.kind === "weekly"
                            ? editing.weekdays?.includes(index)
                            : index > 0 && index < 6
                        }
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : kind === "monthly" ? (
              <div className="wide">
                <h3 className="form-section">Days of the month</h3>
                <div className="weekday-grid month-day-grid">
                  {Array.from({ length: 31 }, (_, index) => index + 1).map(
                    (day) => (
                      <label className="weekday" key={day}>
                        <input
                          type="checkbox"
                          name="month_days"
                          value={day}
                          defaultChecked={
                            editing?.kind === "monthly"
                              ? editing.month_days?.includes(day)
                              : day <= 28 && day % 7 === 1
                          }
                        />
                        <span>{day}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
            ) : (
              <Field label="Available date" wide>
                <input
                  name="on_date"
                  type="date"
                  required
                  defaultValue={editing?.on_date}
                />
              </Field>
            )}
            <Field label="Start time">
              <input
                name="start_time"
                type="time"
                defaultValue={editing?.start_time ?? "09:00"}
                required
              />
            </Field>
            <Field label="End time">
              <input
                name="end_time"
                type="time"
                defaultValue={editing?.end_time ?? "17:00"}
                required
              />
            </Field>
            <Field label="Minimum notice" hint="Minutes before pickup.">
              <input
                name="minimum_notice_minutes"
                type="number"
                min="0"
                defaultValue={editing?.minimum_notice_minutes ?? 60}
                required
              />
            </Field>
            <Field label="Maximum wait" hint="Minutes after pickup time.">
              <input
                name="max_wait_minutes"
                type="number"
                min="0"
                defaultValue={editing?.max_wait_minutes ?? 15}
                required
              />
            </Field>
            <Field label="Service radius (km)" wide>
              <input
                type="number"
                min="1"
                max="200"
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
                required
              />
            </Field>
            <div className="wide">
              <PinMap
                lat={pin.lat}
                lng={pin.lng}
                radius={radius}
                onChange={(lat, lng) => setPin({ lat, lng })}
              />
            </div>
          </Form>
        </Panel>
      )}
      <Panel
        title="Saved availability"
        description="Pause a rule without deleting it, or remove it when you no longer need it."
      >
        <div className="availability-list">
          {data.availability
            .filter(
              (item) => !item.driver_id || item.driver_id === session?.user.id
            )
            .map((item) => (
            <article className="availability-card" key={item.id}>
              <div className="availability-icon">
                <Clock3 size={22} />
              </div>
              <div>
                <div className="section-line">
                  <h3>
                    {item.kind === "weekly"
                      ? "Weekly availability"
                      : item.kind === "monthly"
                        ? "Monthly availability"
                        : "One-time availability"}
                  </h3>
                  <Badge status={item.is_active ? "approved" : "pending"} />
                </div>
                <p>
                  {formatClockTime(item.start_time)}–
                  {formatClockTime(item.end_time)} · {item.radius_km} km radius
                </p>
                <small>
                  {item.kind === "weekly"
                    ? item.weekdays?.map((day) => WEEKDAYS[day]).join(", ")
                    : item.kind === "monthly"
                      ? `Days ${item.month_days?.join(", ")}`
                      : item.on_date}{" "}
                  · {item.timezone}
                </small>
                <small>
                  {item.minimum_notice_minutes} min notice · waits up to{" "}
                  {item.max_wait_minutes} min
                </small>
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => openEdit(item)}
                >
                  <Pencil size={16} /> Edit
                </button>
                <ActionButton
                  onClick={() =>
                    mutate(`/drivers/me/availability/${item.id}`, "PATCH", {
                      is_active: !item.is_active,
                    })
                  }
                >
                  {item.is_active ? (
                    <>
                      <Pause size={16} /> Pause
                    </>
                  ) : (
                    <>
                      <Play size={16} /> Resume
                    </>
                  )}
                </ActionButton>
                <ActionButton
                  className="subtle"
                  onClick={() =>
                    mutate(`/drivers/me/availability/${item.id}`, "DELETE")
                  }
                >
                  <Trash2 size={16} /> Remove
                </ActionButton>
              </div>
            </article>
          ))}
        </div>
        {!data.availability.length && (
          <Empty
            title="No availability yet"
            description="Add a schedule and service area to see matching ride requests."
          />
        )}
      </Panel>
    </Layout>
  )
}

export function DriverVerificationScreen() {
  const { data, mutate } = useCare()
  const [success, setSuccess] = useState("")
  const partnerOrganizations = data.organizations.filter(
    (organization) => organization.type === "partner_org"
  )

  return (
    <Layout driver>
      <PageTitle
        eyebrow="TRUST BUILDS COMMUNITY"
        title="Organization approvals"
        description="Each partner organization reviews drivers before sharing its ride requests."
      />
      {success && <Success>{success}</Success>}
      <div className="booking-columns">
        <Panel
          title="Submit a verification"
          description="Your document is only available to the reviewing organization."
          className="form-panel"
        >
          <Form
            submit="Submit for approval"
            onSubmit={async (form) => {
              await mutate("/drivers/me/verifications", "POST", form)
              setSuccess("Verification submitted for organization review.")
            }}
          >
            <Field label="Approving organization" wide>
              <select name="organization_id" required defaultValue="">
                <option value="" disabled>
                  Select an organization
                </option>
                {partnerOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Document type" wide>
              <select name="check_type" className="document-type-select" required defaultValue="">
                <option value="" disabled>Select a document type</option>
                <option value="drivers_licence">Driver’s licence</option>
                <option value="criminal_record">Criminal record check</option>
              </select>
            </Field>
            <Field
              label="Document"
              wide
              hint="PDF or image supplied for organization review."
            >
              <input
                name="document"
                type="file"
                accept="application/pdf,image/*"
                required
              />
            </Field>
            <Field label="Expiry date">
              <input name="expires_on" type="date" />
            </Field>
          </Form>
        </Panel>
        <div>
        <Panel
          title="Your approval records"
          description="Approved records unlock matching requests from that organization."
        >
          <div className="approval-list">
            {data.verifications.map((record) => (
              <article className="approval-card" key={record.id}>
                <span className="approval-icon">
                  {record.status === "approved" ? (
                    <Check size={20} />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                </span>
                <div>
                  <div className="section-line">
                    <h3>
                      {record.organization?.name ??
                        record.organization_name ??
                        "Partner organization"}
                    </h3>
                    <Badge status={record.status} />
                  </div>
                  <p>{record.check_type.replaceAll("_", " ")}</p>
                  {record.document_ref && (
                    <small>Document: {record.document_ref}</small>
                  )}
                  {record.expires_on && (
                    <small>Expires {record.expires_on}</small>
                  )}
                  {record.reject_reason && (
                    <p className="error-box">{record.reject_reason}</p>
                  )}
                  <ReviewNote record={record} />
                </div>
              </article>
            ))}
          </div>
          {!data.verifications.length && (
            <Empty
              title="No approval records"
              description="Submit a document to a partner organization to begin."
            />
          )}
        </Panel>
        <Panel
          title="Organizations you can apply to"
          description="Submit a verification to any partner organization below."
        >
          <div className="approval-list">
            {partnerOrganizations.map((organization) => {
              const record = data.verifications.find(
                (item) =>
                  item.approved_by_org_id === organization.id ||
                  item.organization?.id === organization.id
              )
              return (
                <article className="approval-card" key={organization.id}>
                  <span className="approval-icon">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <div className="section-line">
                      <h3>{organization.name}</h3>
                      {record ? (
                        <Badge status={record.status} />
                      ) : (
                        <span className="badge">Open</span>
                      )}
                    </div>
                    {organization.address && <p>{organization.address}</p>}
                    <small>
                      {record
                        ? "You already have a record with this organization."
                        : "Use the form to send a verification."}
                    </small>
                  </div>
                </article>
              )
            })}
          </div>
          {!partnerOrganizations.length && (
            <Empty
              title="No partner organizations yet"
              description="Organizations appear here once they join CareRide."
            />
          )}
        </Panel>
        </div>
      </div>
      <p className="info-box">
        <MapPin size={16} /> Approval alone does not reveal rides. Your vehicle,
        active availability, and service area must also match.
      </p>
    </Layout>
  )
}
