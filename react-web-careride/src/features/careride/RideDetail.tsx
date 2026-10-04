import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  ExternalLink,
  Pencil,
  Phone,
  Users,
  Plus,
} from "lucide-react"
import { ConfettiButton } from "../../components/ui/confetti"
import { BookingDayCard } from "./BookingDay"
import { useCare } from "./context"
import { Layout } from "./Layout"
import { queueInstallHelpAfterFirstRideAcceptance } from "./iosInstall"
import {
  Badge,
  Empty,
  PageTitle,
  Panel,
  ReasonAction,
  dateTime,
  passengerName,
  placeLabel,
} from "./ui"
export function RideDetail({ rideId }: { rideId: string }) {
  const { data, session, mutate } = useCare()
  const navigate = useNavigate()
  const driver = session?.user.role === "driver"
  const [mapProvider, setMapProvider] = useState<"google" | "apple">(() => {
    try {
      return localStorage.getItem("careride-map-provider") === "apple"
        ? "apple"
        : "google"
    } catch {
      return "google"
    }
  })
  function selectMapProvider(provider: "google" | "apple") {
    setMapProvider(provider)
    try {
      localStorage.setItem("careride-map-provider", provider)
    } catch {
      /* Keep the selection for this visit if storage is unavailable. */
    }
  }
  const ride = [...data.rides, ...data.availableRides].find(
    (r) => r.id === rideId
  )
  if (!ride)
    return (
      <Layout driver={driver}>
        <Empty
          title="Ride unavailable"
          description="The ride may have changed or is no longer eligible. Return to your dashboard and refresh."
          action={
            <Link to={driver ? "/driver" : "/"} className="btn secondary">
              Back to dashboard
            </Link>
          }
        />
      </Layout>
    )
  const client =
    ride.client ?? data.clients.find((c) => c.id === ride.client_id)
  const assigned = ride.driver_id === session?.user.id
  const maps = mapLinks(ride)
  const steps = [
    { title: "Request submitted", done: true, time: ride.created_at },
    {
      title: "Driver assigned",
      done: !!ride.driver_id,
      time: ride.accepted_at,
    },
    {
      title: "Picked up",
      done: !!ride.picked_up_at || ride.status === "completed",
      time: ride.picked_up_at,
    },
    {
      title: "Arrived at destination",
      done: ride.status === "completed",
      time: ride.completed_at,
    },
  ]
  return (
    <Layout driver={driver}>
      <Link to={driver ? "/driver" : "/rides"} className="text-link">
        ← Back to rides
      </Link>
      <PageTitle
        title={client ? `${client.first_name}’s journey` : "A journey to care."}
        description={
          <span>
            Scheduled pickup:{" "}
            <strong>{dateTime(ride.requested_pickup_at)} </strong>·
            America/Vancouver
          </span>
        }
        action={
          <div className="booking-heading-actions">
            <Badge status={ride.status} />
            {!driver && (
              <Link
                to="/book"
                search={{ client: undefined, edit: undefined }}
                className="btn primary"
              >
                <Plus size={16} /> New booking
              </Link>
            )}
          </div>
        }
      />
      <div className="booking-columns">
        <div>
          {driver &&
            assigned &&
            ["accepted", "in_progress"].includes(ride.status) && (
              <Panel
                title="Ride actions"
                description={
                  ride.status === "accepted"
                    ? "Confirm the passenger is with you before starting the journey."
                    : "Complete the ride once the passenger reaches their destination."
                }
              >
                <div className="action-row">
                  {ride.status === "accepted" && (
                    <ConfettiButton
                      className="btn primary"
                      onClick={() => mutate(`/rides/${ride.id}/pickup`)}
                    >
                      Mark picked up
                    </ConfettiButton>
                  )}
                  {ride.status === "in_progress" && (
                    <ConfettiButton
                      className="btn primary"
                      bursts={3}
                      onClick={() => mutate(`/rides/${ride.id}/dropoff`)}
                    >
                      Successfully dropped off rider <Check size={18} />
                    </ConfettiButton>
                  )}
                  {ride.status === "accepted" && (
                    <>
                      <ReasonAction
                        title="Client no-show"
                        onSubmit={(reason) =>
                          mutate(`/rides/${ride.id}/no-show`, "POST", {
                            reason,
                          })
                        }
                      />
                      <ReasonAction
                        title="Withdraw from ride"
                        onSubmit={(reason) =>
                          mutate(`/rides/${ride.id}/withdraw`, "POST", {
                            reason,
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </Panel>
            )}
          {driver &&
            !ride.driver_id &&
            ride.status === "requested" &&
            ride.can_accept !== false && (
              <Panel
                title="Ride actions"
                description="Review the route and confirm that you can take this ride."
              >
                <ConfettiButton
                  onClick={async () => {
                    await mutate(`/rides/${ride.id}/accept`)
                    if (session?.user.id)
                      queueInstallHelpAfterFirstRideAcceptance(session.user.id)
                    sessionStorage.setItem(
                      "careride-driver-confirmation",
                      "You’re good to go. The ride is now in your upcoming rides."
                    )
                    await navigate({ to: "/driver" })
                  }}
                  className="btn primary"
                >
                  Confirm ride
                </ConfettiButton>
              </Panel>
            )}
          {driver &&
            !ride.driver_id &&
            ride.status === "requested" &&
            ride.can_accept === false && (
              <Panel title="Other leg of this appointment">
                <p className="muted">
                  This leg is shown with the round trip, but it does not
                  currently match your availability or vehicle requirements. You
                  can accept the eligible leg separately.
                </p>
              </Panel>
            )}
          {!driver && (
            <Panel title="Booking details">
              <>
                <p className="muted">
                  {ride.status === "requested"
                    ? "Your request is waiting for an eligible driver. You can edit it until a driver is assigned."
                    : "This screen shows the booking snapshot saved when the ride was requested."}
                </p>
                <div className="staff-booking-actions">
                  {ride.status === "requested" && (
                    <Link
                      to="/book"
                      search={{ edit: ride.id, client: ride.client_id }}
                      className="btn secondary"
                    >
                      <Pencil size={16} /> Edit booking
                    </Link>
                  )}
                  {["requested", "accepted"].includes(ride.status) && (
                    <ReasonAction
                      title="Cancel booking"
                      onSubmit={(reason) =>
                        mutate(`/rides/${ride.id}/cancel`, "POST", { reason })
                      }
                    />
                  )}
                </div>
              </>
              {ride.cancelled_reason && (
                <p>Cancellation reason: {ride.cancelled_reason}</p>
              )}
            </Panel>
          )}
          {driver &&
            ["completed", "cancelled", "no_show"].includes(ride.status) && (
              <Panel title="Ride actions">
                <p className="muted">This journey is closed.</p>
              </Panel>
            )}
          <Panel
            title="The journey"
            action={<span className="free-tag">Free ride</span>}
          >
            <div className="detail-route">
              {(
                [
                  ["PICKUP", "pickup", ride.pickup_address],
                  ["DESTINATION", "destination", ride.destination_address],
                ] as const
              ).map(([label, kind, address]) => {
                const name = placeLabel(ride, kind, data.destinations)
                return (
                  <div key={label}>
                    {kind === "pickup" ? (
                      <span className="route-point" />
                    ) : (
                      <MapPin size={20} />
                    )}
                    <div>
                      <small>{label}</small>
                      <h3>{name}</h3>
                      {name !== address && <p>{address}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="detail-grid">
              <div>
                <small>Primary client</small>
                <strong>
                  {client || ride.client_name
                    ? passengerName(ride, client, driver)
                    : "Passenger information at assignment"}
                </strong>
              </div>
              <div>
                <small>Passengers</small>
                <strong>
                  <Users size={16} />
                  {ride.passenger_count}
                </strong>
              </div>
              <div>
                <small>Accessibility</small>
                <strong>{ride.accessibility_needs || "None requested"}</strong>
              </div>
            </div>
            {(ride.notes || client?.notes) && (
              <div className="info-box">
                {ride.notes}
                {client?.notes && <p>Client accommodations: {client.notes}</p>}
              </div>
            )}
            {ride.linked_ride_id && (
              <Link
                className="text-link"
                to="/rides/$rideId"
                params={{ rideId: ride.linked_ride_id }}
              >
                View linked {ride.trip_leg === "return" ? "outbound" : "return"}{" "}
                ride <ArrowRight size={15} />
              </Link>
            )}
            {driver && (
              <div className="directions-controls">
                <div className="directions-heading">
                  <h3>Get directions</h3>
                  <div
                    className="view-tabs"
                    role="group"
                    aria-label="Directions app"
                  >
                    {(["google", "apple"] as const).map((provider) => (
                      <button
                        type="button"
                        key={provider}
                        aria-pressed={mapProvider === provider}
                        className={mapProvider === provider ? "active" : ""}
                        onClick={() => selectMapProvider(provider)}
                      >
                        {provider === "google" ? "Google Maps" : "Apple Maps"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="action-row">
                  {(["pickup", "destination"] as const).map((place) => (
                    <a
                      key={place}
                      className="btn secondary"
                      href={maps[mapProvider][place]}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {place === "pickup" ? "Pickup" : "Destination"}{" "}
                      <ExternalLink size={17} />
                    </a>
                  ))}
                </div>
                {ride.organization_phone && (
                  <a
                    className="btn secondary"
                    href={`tel:${ride.organization_phone.replace(/[^\d+]/g, "")}`}
                  >
                    <Phone size={17} />
                    Call {ride.organization_name ?? "organization"} ·{" "}
                    {ride.organization_phone}
                  </a>
                )}
              </div>
            )}
          </Panel>
        </div>
        <div>
          {driver && (
            <BookingDayCard
              ride={ride}
              rides={data.rides}
              destinations={data.destinations}
            />
          )}
          <Panel title="Ride progress">
            <ol className="timeline">
              {steps.map((s, i) => (
                <li key={s.title} className={s.done ? "done" : ""}>
                  <span>{s.done ? <Check size={15} /> : i + 1}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {s.time
                        ? dateTime(s.time)
                        : s.done
                          ? "Confirmed"
                          : "Up next"}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {["cancelled", "no_show"].includes(ride.status) && (
              <Badge status={ride.status} />
            )}
          </Panel>
          {!driver && (
            <Panel title="Your driver">
              {ride.driver ? (
                <>
                  <h3>{ride.driver.name}</h3>
                  <p>
                    {ride.driver.vehicle
                      ? `${ride.driver.vehicle.make} ${ride.driver.vehicle.model} · ${ride.driver.vehicle.plate}`
                      : "Vehicle details will appear here."}
                  </p>
                  <a className="text-link" href={`tel:${ride.driver.phone}`}>
                    <Phone size={15} />
                    {ride.driver.phone}
                  </a>
                </>
              ) : (
                <Empty
                  title="A helping hand is on the way."
                  description="Driver details appear once the request is accepted."
                />
              )}
              {ride.waiting_minutes != null && (
                <p className="info-box">
                  <Clock3 size={16} />
                  Driver waiting policy: {ride.waiting_minutes} minutes after
                  scheduled pickup.
                </p>
              )}
              {ride.staff?.phone && (
                <a href={`tel:${ride.staff.phone}`} className="text-link">
                  Contact booking staff: {ride.staff.name}
                </a>
              )}
            </Panel>
          )}
        </div>
      </div>
    </Layout>
  )
}

function mapLinks(ride: {
  pickup_lat?: number
  pickup_lng?: number
  destination_lat?: number
  destination_lng?: number
  pickup_address: string
  destination_address: string
}) {
  const point = (kind: "pickup" | "destination") => {
    const lat = ride[`${kind}_lat`]
    const lng = ride[`${kind}_lng`]
    return encodeURIComponent(
      lat != null && lng != null ? `${lat},${lng}` : ride[`${kind}_address`]
    )
  }
  return {
    google: {
      pickup: `https://www.google.com/maps/dir/?api=1&destination=${point("pickup")}&travelmode=driving`,
      destination: `https://www.google.com/maps/dir/?api=1&origin=${point("pickup")}&destination=${point("destination")}&travelmode=driving`,
    },
    apple: {
      pickup: `https://maps.apple.com/?daddr=${point("pickup")}&dirflg=d`,
      destination: `https://maps.apple.com/?saddr=${point("pickup")}&daddr=${point("destination")}&dirflg=d`,
    },
  }
}
