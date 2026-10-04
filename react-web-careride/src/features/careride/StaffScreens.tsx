import { useState, type FocusEvent } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowRight, MapPin, Search, Users } from "lucide-react"
import { useCare } from "./context"
import { Layout } from "./Layout"
import {
  ActionButton,
  AddLink,
  Badge,
  Empty,
  Field,
  Form,
  PageTitle,
  Panel,
  ReasonAction,
  ReviewNote,
  Success,
  dateTime,
} from "./ui"
import { PinMap } from "./MapPin"
import { fireConfetti } from "@/components/ui/confetti"
import { addDays, vancouverMinutes, vancouverYmd } from "./dates"
import type { Client, Destination, Ride } from "./types"

function upcomingQuarterSlot(now = new Date()) {
  const ymd = vancouverYmd(now)
  const minutes = vancouverMinutes(now.toISOString())
  const slot = Math.ceil((minutes + 1) / 15) * 15
  if (slot >= 24 * 60) return { date: addDays(ymd, 1), time: "00:00" }
  const hour = String(Math.floor(slot / 60)).padStart(2, "0")
  const minute = String(slot % 60).padStart(2, "0")
  return { date: ymd, time: `${hour}:${minute}` }
}

const quarterHourTimes = Array.from({ length: 24 * 4 }, (_, index) => {
  const hour = String(Math.floor(index / 4)).padStart(2, "0")
  const minute = String((index % 4) * 15).padStart(2, "0")
  return `${hour}:${minute}`
})

export function ClientsScreen() {
  const { data } = useCare()
  const [q, setQ] = useState("")
  const clients = data.clients.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.toLowerCase())
  )
  return (
    <Layout>
      <PageTitle
        title="People at the heart of it."
        description="Manage client details and help them take their next step."
        action={<AddLink to="/clients/new">Register client</AddLink>}
      />
      <Panel>
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="Search clients"
            placeholder="Search clients by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="client-grid">
          {clients.map((c) => (
            <div className="client-card" key={c.id}>
              <span className="client-avatar">
                <Users size={23} />
              </span>
              <h3>
                {c.first_name} {c.last_name}
              </h3>
              <p>{c.address || "No address recorded"}</p>
              <small>{c.notes || "No accommodations recorded"}</small>
              <div>
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: c.id }}
                  className="text-link"
                >
                  View & edit <ArrowRight size={15} />
                </Link>
                <Link
                  to="/book"
                  search={{ client: c.id }}
                  className="btn secondary"
                >
                  Book a ride
                </Link>
              </div>
            </div>
          ))}
        </div>
        {!clients.length && (
          <Empty
            title="No clients found"
            description="Register a client or try a different name."
          />
        )}
      </Panel>
    </Layout>
  )
}
export function ClientScreen({ clientId }: { clientId?: string }) {
  const { data, mutate } = useCare()
  const navigate = useNavigate()
  const client = data.clients.find((c) => c.id === clientId)
  if (clientId && !client)
    return (
      <Layout>
        <Empty
          title="Client unavailable"
          description="Return to the client list or refresh your workspace."
          action={
            <Link to="/clients" className="btn secondary">
              Back to clients
            </Link>
          }
        />
      </Layout>
    )
  return (
    <Layout>
      <PageTitle
        title={
          client
            ? `${client.first_name} ${client.last_name}`
            : "Welcome someone new."
        }
        description="Only name and date of birth are required. Keep the rest simple."
      />
      <Panel title="Client details" className="form-panel">
        <Form
          submit="Save client"
          onSubmit={async (f) => {
            await mutate<Client>(
              clientId ? `/clients/${clientId}` : "/clients",
              clientId ? "PATCH" : "POST",
              {
                ...Object.fromEntries(f),
                has_smartphone: f.has("has_smartphone"),
              }
            )
            await navigate({ to: "/clients" })
          }}
        >
          <Field label="First name">
            <input
              name="first_name"
              defaultValue={client?.first_name}
              required
            />
          </Field>
          <Field label="Last name">
            <input name="last_name" defaultValue={client?.last_name} required />
          </Field>
          <Field label="Date of birth">
            <input
              name="dob"
              type="date"
              defaultValue={client?.dob}
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Address / transitional home">
            <input name="address" defaultValue={client?.address} />
          </Field>
          <label className="checkbox wide">
            <input
              name="has_smartphone"
              type="checkbox"
              defaultChecked={client?.has_smartphone}
            />
            Client has a smartphone
          </label>
          <Field label="Phone (optional)">
            <input name="phone" type="tel" defaultValue={client?.phone} />
          </Field>
          <Field label="Email (optional)">
            <input name="email" type="email" defaultValue={client?.email} />
          </Field>
          <Field label="Emergency contact name">
            <input
              name="emergency_contact_name"
              defaultValue={client?.emergency_contact_name}
            />
          </Field>
          <Field label="Emergency contact phone">
            <input
              name="emergency_contact_phone"
              type="tel"
              defaultValue={client?.emergency_contact_phone}
            />
          </Field>
          <Field
            label="Accommodations / important information"
            hint="Maximum 50 characters."
            wide
          >
            <textarea
              name="notes"
              maxLength={50}
              defaultValue={client?.notes}
            />
          </Field>
        </Form>
      </Panel>
    </Layout>
  )
}
export function LocationsScreen() {
  const { data, mutate } = useCare()
  const [q, setQ] = useState("")
  const [type, setType] = useState("all")
  const locations = data.destinations.filter(
    (d) =>
      `${d.name} ${d.address}`.toLowerCase().includes(q.toLowerCase()) &&
      (type === "all" || d.type === type)
  )
  return (
    <Layout>
      <PageTitle
        title="Places that make a difference."
        description="Save your community’s pickup points and essential destinations."
        action={<AddLink to="/locations/new">Add location</AddLink>}
      />
      <Panel>
        <div className="filter-bar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search locations"
              placeholder="Search name or address…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label="Location type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">All location types</option>
            <option value="hospital">Hospital</option>
            <option value="shelter">Shelter</option>
            <option value="service">Service</option>
          </select>
        </div>
        <div className="location-grid">
          {locations.map((d) => (
            <div className="location-card" key={d.id}>
              <div className="section-line">
                <span className="quick-icon">
                  <MapPin size={23} />
                </span>
                <span
                  className={`badge ${d.is_active ? "approved" : "pending"}`}
                >
                  <span />
                  {d.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <small className="eyebrow">{d.type}</small>
              <h3>{d.name}</h3>
              <p>{d.address}</p>
              <div className="section-line">
                <Link
                  className="text-link"
                  to="/locations/$locationId"
                  params={{ locationId: d.id }}
                >
                  Edit location <ArrowRight size={15} />
                </Link>
                <ActionButton
                  onClick={() =>
                    mutate(`/destinations/${d.id}`, "PATCH", {
                      is_active: !d.is_active,
                    })
                  }
                >
                  {d.is_active ? "Deactivate" : "Activate"}
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
        {!locations.length && (
          <Empty
            title="No locations found"
            description="Add a location to make booking easier."
          />
        )}
      </Panel>
    </Layout>
  )
}
export function LocationScreen({ locationId }: { locationId?: string }) {
  const { data, mutate } = useCare()
  const navigate = useNavigate()
  const location = data.destinations.find((d) => d.id === locationId)
  if (locationId && !location)
    return (
      <Layout>
        <Empty
          title="Location unavailable"
          description="Return to the address book and try again."
        />
      </Layout>
    )
  return (
    <LocationForm
      key={location?.id ?? "new"}
      location={location}
      save={async (f) => {
        await mutate(
          location ? `/destinations/${location.id}` : "/destinations",
          location ? "PATCH" : "POST",
          f
        )
        await navigate({ to: "/locations" })
      }}
    />
  )
}
function LocationForm({
  location,
  save,
}: {
  location?: Destination
  save: (body: unknown) => Promise<void>
}) {
  const [lat, setLat] = useState(location?.lat ?? 49.2665)
  const [lng, setLng] = useState(location?.lng ?? -123.1128)
  return (
    <Layout>
      <PageTitle
        title={
          location
            ? "A familiar place, kept current."
            : "Add a community destination."
        }
        description="Type the address and place a pin to help match nearby drivers."
      />
      <Panel className="form-panel" title="Location details">
        <Form
          submit="Save location"
          onSubmit={async (f) =>
            save({
              ...Object.fromEntries(f),
              lat,
              lng,
              is_active: f.has("is_active"),
            })
          }
        >
          <Field label="Location name" wide>
            <input name="name" defaultValue={location?.name} required />
          </Field>
          <Field label="Location type" wide>
            <select name="type" defaultValue={location?.type ?? "service"}>
              <option value="hospital">Hospital</option>
              <option value="shelter">Shelter</option>
              <option value="service">Service</option>
            </select>
          </Field>
          <Field label="Street address" wide>
            <input name="address" defaultValue={location?.address} required />
          </Field>
          <div className="wide">
            <PinMap
              lat={lat}
              lng={lng}
              onChange={(a, b) => {
                setLat(a)
                setLng(b)
              }}
            />
          </div>
          <Field label="Latitude">
            <input
              type="number"
              min={-85}
              max={85}
              step="any"
              required
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              min={-180}
              max={180}
              step="any"
              required
              value={lng}
              onChange={(e) => setLng(Number(e.target.value))}
            />
          </Field>
          <label className="checkbox wide">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={location?.is_active ?? true}
            />
            Active — available for new bookings
          </label>
        </Form>
      </Panel>
    </Layout>
  )
}
export function BookingScreen({
  selectedClient,
  editRideId,
}: {
  selectedClient?: string
  editRideId?: string
}) {
  const { data } = useCare()
  const editingRide = editRideId
    ? data.rides.find((ride) => ride.id === editRideId)
    : undefined

  if (editRideId && !editingRide)
    return (
      <Layout>
        <Empty
          title="Booking unavailable"
          description="This booking may have changed or may no longer be available to edit."
          action={
            <Link to="/rides" className="btn secondary">
              Back to bookings
            </Link>
          }
        />
      </Layout>
    )

  return (
    <BookingForm selectedClient={selectedClient} editingRide={editingRide} />
  )
}

function BookingForm({
  selectedClient,
  editingRide,
}: {
  selectedClient?: string
  editingRide?: Ride
}) {
  const { data, mutate } = useCare()
  const navigate = useNavigate()
  const initialPickup =
    editingRide?.pickup_id ??
    data.destinations.find(
      (item) => item.address === editingRide?.pickup_address
    )?.id ??
    ""
  const initialDestination =
    editingRide?.destination_id ??
    data.destinations.find(
      (item) => item.address === editingRide?.destination_address
    )?.id ??
    ""
  const [pickup, setPickup] = useState(initialPickup)
  const [destination, setDestination] = useState(initialDestination)
  const [roundTrip, setRoundTrip] = useState(false)
  const [slot] = useState(upcomingQuarterSlot)
  const editingMinutes = editingRide
    ? vancouverMinutes(editingRide.requested_pickup_at)
    : undefined
  const [pickupDate, setPickupDate] = useState(
    editingRide
      ? vancouverYmd(new Date(editingRide.requested_pickup_at))
      : slot.date
  )
  const [pickupTime, setPickupTime] = useState(
    editingMinutes == null
      ? slot.time
      : `${String(Math.floor(editingMinutes / 60)).padStart(2, "0")}:${String(editingMinutes % 60).padStart(2, "0")}`
  )
  const [returnDate, setReturnDate] = useState("")
  const locations = data.destinations.filter((d) => d.is_active)
  const openDatePicker = (event: FocusEvent<HTMLInputElement>) => {
    try {
      event.currentTarget.showPicker?.()
    } catch (error) {
      // Programmatic focus may lack the user activation required by the browser.
      if (!(error instanceof DOMException && error.name === "NotAllowedError"))
        throw error
    }
  }
  return (
    <Layout>
      <PageTitle
        eyebrow="A JOURNEY TO CARE"
        title={editingRide ? "Update this journey." : "Let’s get them there."}
        description={
          editingRide
            ? "Changes are available until a driver confirms the ride."
            : "Arrange a free ride to the places that matter."
        }
      />
      <div className="booking-columns">
        <Panel
          title={editingRide ? "Edit booking" : "Book a ride"}
          className="form-panel"
        >
          <Form
            submit={editingRide ? "Save booking" : "Make booking"}
            onSubmit={async (f) => {
              const p = locations.find((d) => d.id === pickup)
              const d = locations.find((d) => d.id === destination)
              if (!p || !d) throw new Error("Choose a pickup and destination.")
              if (p.id === d.id)
                throw new Error(
                  "Pickup and destination must be different places."
                )
              const pickupAt = new Date(
                `${f.get("requested_pickup_date")}T${f.get("requested_pickup_time")}`
              )
              if (Number.isNaN(pickupAt.getTime()) || pickupAt <= new Date())
                throw new Error("Choose a pickup time in the future.")
              const returnAt = roundTrip
                ? new Date(
                    `${f.get("return_pickup_date")}T${f.get("return_pickup_time")}`
                  )
                : undefined
              if (
                returnAt &&
                (Number.isNaN(returnAt.getTime()) || returnAt <= pickupAt)
              )
                throw new Error(
                  "Return pickup must be after the outbound pickup."
                )
              for (const name of [
                "requested_pickup_date",
                "requested_pickup_time",
                "return_pickup_date",
                "return_pickup_time",
              ])
                f.delete(name)
              const body = {
                ...Object.fromEntries(f),
                pickup_destination_id: p.id,
                pickup_id: p.id,
                pickup_address: p.address,
                pickup_lat: p.lat,
                pickup_lng: p.lng,
                destination_destination_id: d.id,
                destination_id: d.id,
                destination_address: d.address,
                destination_lat: d.lat,
                destination_lng: d.lng,
                requested_pickup_at: pickupAt.toISOString(),
                return_pickup_at: returnAt?.toISOString(),
                passenger_count: Number(f.get("passenger_count")),
                accessibility_needs: f.getAll("accessibility").join(", "),
                trip_type: roundTrip ? "round_trip" : "one_way",
                round_trip: roundTrip,
                ride_option: "free",
              }
              const result = await mutate<Ride | Ride[]>(
                editingRide ? `/rides/${editingRide.id}` : "/rides",
                editingRide ? "PATCH" : "POST",
                body
              )
              const ride = Array.isArray(result) ? result[0] : result
              if (!editingRide) fireConfetti()
              await navigate({
                to: "/rides/$rideId",
                params: { rideId: ride.id },
              })
            }}
          >
            <Field label="Primary client" wide>
              <select
                name="client_id"
                defaultValue={editingRide?.client_id ?? selectedClient ?? ""}
                required
              >
                <option value="" disabled>
                  Select a client
                </option>
                {data.clients.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="wide">
              <Link to="/clients/new" className="text-link">
                + Register a new client
              </Link>
            </div>
            <Field label="Pickup location" wide>
              <select
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                required
              >
                <option value="">Choose from the address book</option>
                {locations.map((d) => (
                  <option
                    key={d.id}
                    value={d.id}
                    disabled={d.id === destination}
                  >
                    {d.name}
                  </option>
                ))}
              </select>
              {pickup && (
                <span className="address-preview">
                  {locations.find((d) => d.id === pickup)?.address}
                </span>
              )}
            </Field>
            <Field label="Destination" wide>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              >
                <option value="">Where are they going?</option>
                {locations.map((d) => (
                  <option key={d.id} value={d.id} disabled={d.id === pickup}>
                    {d.name}
                  </option>
                ))}
              </select>
              {destination && (
                <span className="address-preview">
                  {locations.find((d) => d.id === destination)?.address}
                </span>
              )}
            </Field>
            <div className="wide">
              <Link to="/locations/new" className="text-link">
                + Add a location to the address book
              </Link>
            </div>
            {!editingRide && (
              <Field label="Trip type" wide>
                <select
                  value={roundTrip ? "round_trip" : "one_way"}
                  onChange={(e) =>
                    setRoundTrip(e.target.value === "round_trip")
                  }
                >
                  <option value="one_way">One-way journey</option>
                  <option value="round_trip">
                    Round trip — two separate ride requests
                  </option>
                </select>
              </Field>
            )}
            <Field label="Pickup date">
              <input
                name="requested_pickup_date"
                type="date"
                value={pickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
                onFocus={openDatePicker}
                required
              />
            </Field>
            <Field label="Pickup time" hint="America/Vancouver">
              <select
                name="requested_pickup_time"
                value={pickupTime}
                onChange={(event) => setPickupTime(event.target.value)}
                required
              >
                {quarterHourTimes.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </Field>
            {roundTrip && (
              <>
                <Field
                  label="Return pickup date"
                  hint="Each direction is accepted separately."
                >
                  <input
                    name="return_pickup_date"
                    type="date"
                    value={returnDate || pickupDate}
                    onChange={(event) => setReturnDate(event.target.value)}
                    onFocus={openDatePicker}
                    required
                  />
                </Field>
                <Field label="Return pickup time" hint="America/Vancouver">
                  <select name="return_pickup_time" defaultValue="" required>
                    <option value="" disabled>
                      Select time
                    </option>
                    {quarterHourTimes.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Passengers" hint="Include accompanying passengers.">
              <input
                name="passenger_count"
                type="number"
                min={1}
                max={30}
                defaultValue={editingRide?.passenger_count ?? 1}
                required
              />
            </Field>
            <div className="wide">
              <h3 className="form-section">Accessibility needs</h3>
              <div className="checkbox-group">
                {["Wheelchair", "Mobility aid", "Other"].map((s) => (
                  <label key={s} className="checkbox">
                    <input
                      name="accessibility"
                      type="checkbox"
                      value={s.toLowerCase()}
                      defaultChecked={editingRide?.accessibility_needs
                        ?.toLowerCase()
                        .includes(s.toLowerCase())}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Ride notes (optional)" wide>
              <textarea
                name="notes"
                placeholder="Anything the driver should know?"
                maxLength={1000}
                defaultValue={editingRide?.notes}
              />
            </Field>
          </Form>
        </Panel>
        <div>
          <Panel title="Care without a cost." className="help-panel">
            <h3>Every ride is free.</h3>
            <p>
              Your request is available to eligible, organization-approved
              drivers as soon as you submit it.
            </p>
            <div className="free-price">
              $0<span>for the client</span>
            </div>
          </Panel>
          <Panel title="In an emergency" className="emergency-panel">
            <h3>Call 911.</h3>
            <p>
              CareRide is for planned trips to essential services, not
              emergencies.
            </p>
            <a
              className="btn secondary"
              href="https://erstat.ca/hospitals/bc/vancouver"
              target="_blank"
              rel="noreferrer"
            >
              Vancouver ER wait times
            </a>
          </Panel>
        </div>
      </div>
    </Layout>
  )
}
export function NotificationsScreen() {
  const { data, mutate } = useCare()
  const [unread, setUnread] = useState(false)
  const notices = data.notifications.filter((n) => !unread || !n.read_at)
  return (
    <Layout>
      <PageTitle
        title="You’re in the loop."
        description="Booking confirmations, driver assignments, and completed journeys."
      />
      <Panel>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => setUnread(e.target.checked)}
          />
          Show unread only
        </label>
        <div className="notice-list">
          {notices.map((n) => (
            <article
              key={n.id}
              className={`notice ${n.read_at ? "" : "unread"}`}
            >
              <div>
                <h3>
                  {n.message ??
                    {
                      confirmation: "Your ride request is confirmed",
                      driver_assigned: "A driver has accepted your ride",
                      completed: "Your client has arrived",
                      cancelled: "Ride cancelled",
                    }[n.type] ??
                    "Ride update"}
                </h3>
                <p>
                  {n.sent_at ? dateTime(n.sent_at) : "New update"} · In-app
                  notification
                </p>
                <Link
                  to="/rides/$rideId"
                  params={{ rideId: n.ride_request_id }}
                  className="text-link"
                >
                  View booking <ArrowRight size={15} />
                </Link>
              </div>
              {!n.read_at && (
                <ActionButton
                  onClick={() => mutate(`/notifications/${n.id}/read`)}
                >
                  Mark as read
                </ActionButton>
              )}
            </article>
          ))}
        </div>
        {!notices.length && (
          <Empty
            title="You’re all caught up."
            description="Updates will appear as your clients’ rides move forward."
          />
        )}
      </Panel>
    </Layout>
  )
}
export function ApprovalsScreen() {
  const { data, mutate } = useCare()
  const [success, setSuccess] = useState("")
  return (
    <Layout>
      <PageTitle
        title="Welcome a helping hand."
        description="Organization approval gives a driver access to your eligible ride requests."
      />
      {success && <Success>{success}</Success>}
      <Panel title="Driver verification records">
        {data.verifications.map((v) => (
          <article key={v.id} className="verification-row">
            <div className="section-line">
              <div>
                <h3>{v.driver?.name ?? "Volunteer driver"}</h3>
                <p>
                  {v.check_type} check · {v.driver?.email}
                </p>
              </div>
              <Badge status={v.status} />
            </div>
            {v.document_ref && (
              <p className="muted">Submitted document: {v.document_ref}</p>
            )}
            <p className="muted">
              {v.issued_on && `Issued ${v.issued_on}`}{" "}
              {v.expires_on && ` · Expires ${v.expires_on}`}
            </p>
            {v.reject_reason && <p className="error-box">{v.reject_reason}</p>}
            <ReviewNote record={v} />
            {v.status === "pending" && (
              <div className="action-row">
                <ActionButton
                  className="primary"
                  onClick={async () => {
                    await mutate(`/admin/verifications/${v.id}/approve`)
                    setSuccess("Driver approved for your organization.")
                  }}
                >
                  Approve driver
                </ActionButton>
                <ReasonAction
                  title="Reject submission"
                  onSubmit={(reason) =>
                    mutate(`/admin/verifications/${v.id}/reject`, "POST", {
                      reason,
                    })
                  }
                />
              </div>
            )}
          </article>
        ))}
        {!data.verifications.length && (
          <Empty
            title="No submissions to review"
            description="Driver verification submissions will appear here."
          />
        )}
      </Panel>
    </Layout>
  )
}
